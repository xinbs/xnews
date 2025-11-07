import { $fetch } from "ofetch"
import { decodeBase64URL } from "#/utils/base64"

function parseFrameAncestors(csp?: string) {
  const ret = { present: false, values: [] as string[] }
  if (!csp) return ret
  const parts = csp.split(";").map(s => s.trim())
  const fa = parts.find(p => p.toLowerCase().startsWith("frame-ancestors"))
  if (!fa) return ret
  ret.present = true
  const values = fa.split(/\s+/).slice(1)
  ret.values = values
  return ret
}

export default defineEventHandler(async (event) => {
  const { url, type = "encodeURIComponent" } = getQuery(event)
  if (!url) {
    throw createError({ statusCode: 400, message: "Missing url" })
  }
  const target = type === "encodeURIComponent"
    ? decodeURIComponent(url as string)
    : decodeBase64URL(url as string)

  try {
    const res = await $fetch.raw(target, {
      method: "GET",
      headers: {
        Accept: "text/html,*/*",
      },
      redirect: "manual",
    })
    const xfo = res.headers.get("x-frame-options") || res.headers.get("X-Frame-Options") || ""
    const csp = res.headers.get("content-security-policy") || res.headers.get("Content-Security-Policy") || ""

    let blocked = false
    if (xfo) blocked = true
    const fa = parseFrameAncestors(csp)
    if (fa.present) {
      const values = fa.values.map(v => v.toLowerCase())
      if (values.includes("'none'")) blocked = true
      else if (!values.includes("*")) blocked = true
    }

    return { blocked, xfo, csp }
  } catch (e: any) {
    // 网络或跨域异常时，保守认为阻止嵌入
    return { blocked: true, error: e?.message || "Probe failed" }
  }
})
