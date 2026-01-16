import { useAtom } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { currentReaderPreviewAtom } from "~/atoms/reader"
import { useRelativeTime } from "~/hooks/useRelativeTime"
import { myFetch } from "~/utils"

export function Detail() {
  const [preview] = useAtom(currentReaderPreviewAtom)
  // 保持 hooks 调用顺序一致：无论是否有 preview 都计算时间
  const timestamp = (preview?.pubDate || preview?.extra?.date || "") as any
  const time = useRelativeTime(timestamp)

  // 预计算预览地址与域名，保持 hooks 顺序一致
  const url = (preview?.mobileUrl || preview?.url || "") as string
  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return ""
    }
  }, [url])
  // 这些站点通常禁止被 iframe 嵌入
  const blockedPreviewHosts = useMemo(() => new Set([
    "www.toutiao.com",
    "toutiao.com",
    "m.toutiao.com",
    "www.zhihu.com",
    "zhihu.com",
    "m.zhihu.com",
    "zhuanlan.zhihu.com",
    "weibo.com",
    "www.weibo.com",
  ]), [])
  const [probeBlocked, setProbeBlocked] = useState<boolean | null>(null)
  const useRenderProxy = blockedPreviewHosts.has(hostname) || probeBlocked === true

  // 动态探测是否被禁止嵌入（X-Frame-Options / CSP frame-ancestors）
  useEffect(() => {
    let active = true
    // 已知受限域名直接标记，不做多余探测
    if (blockedPreviewHosts.has(hostname)) {
      setProbeBlocked(true)
      return () => {
        active = false
      }
    }
    setProbeBlocked(null)
    if (url) {
      const q = new URLSearchParams({ type: "encodeURIComponent", url })
      myFetch(`/probe/frame?${q.toString()}`)
        .then((res: any) => {
          if (active) setProbeBlocked(Boolean(res?.blocked))
        })
        .catch(() => {
          if (active) setProbeBlocked(false)
        })
    }
    return () => {
      active = false
    }
  }, [blockedPreviewHosts, hostname, url])

  const [renderHTML, setRenderHTML] = useState<string>("")
  const [renderError, setRenderError] = useState<string>("")
  const [allowScripts, setAllowScripts] = useState<boolean>(false)
  const [useExtractMode, setUseExtractMode] = useState<boolean>(false)

  // 计算 render 接口地址，脚本模式下改用 src 加载，避免 srcDoc 对个别站点不兼容
  const renderEndpoint = useMemo(() => {
    if (!useRenderProxy || !url) return ""
    const q = new URLSearchParams({ type: "encodeURIComponent", url })
    if (allowScripts) q.set("scripts", "1")
    if (useExtractMode) q.set("mode", "extract")
    return `/api/render?${q.toString()}`
  }, [useRenderProxy, url, allowScripts, useExtractMode])

  useEffect(() => {
    let active = true
    setRenderHTML("")
    setRenderError("")
    if (useRenderProxy && url) {
      // 可选择性开启脚本支持（默认关闭更安全）
      const q = new URLSearchParams({ type: "encodeURIComponent", url })
      if (allowScripts) q.set("scripts", "1")
      if (useExtractMode) q.set("mode", "extract")
      myFetch(`/render?${q.toString()}`)
        .then((html: string) => {
          if (active) setRenderHTML(html)
        })
        .catch((e: any) => {
          if (active) setRenderError(e?.message || "渲染失败")
        })
    }
    return () => {
      active = false
    }
  }, [useRenderProxy, url, allowScripts, useExtractMode])
  // 无预览时不要显示提示文案，避免影响阅读视觉
  if (!preview) {
    return (
      <div className="h-full" aria-hidden />
    )
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="px-2 py-2">
        <h2 className="text-base font-bold mb-1 leading-snug">{preview.title}</h2>
        {/* 额外信息与相对时间 */}
        <div className="text-xs op-60 mb-2">
          {time && (
            <span>
              更新时间：
              {time}
            </span>
          )}
          {preview.extra?.info && <span className="ml-2">{preview.extra.info}</span>}
          {!preview.extra?.info && preview.extra?.hover && <span className="ml-2">{preview.extra.hover}</span>}
        </div>
        <a className="btn px-2 py-1 rounded-md color-primary bg-primary/10" href={preview.url} target="_blank" rel="noreferrer">前往原文</a>
        {useRenderProxy && (
          <label className="ml-2 inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={allowScripts}
              onChange={e => setAllowScripts(e.target.checked)}
            />
            允许脚本预览（实验）
          </label>
        )}
        {useRenderProxy && (
          <label className="ml-2 inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={useExtractMode}
              onChange={e => setUseExtractMode(e.target.checked)}
            />
            阅读模式（抽取）
          </label>
        )}
      </div>
      <div className="mt-3 border-t border-base">
        {useRenderProxy
          ? (
              allowScripts && renderEndpoint
                ? (
                    <iframe
                      src={renderEndpoint}
                      title={String(preview.id)}
                      className="w-full h-[calc(100vh-180px)] rounded-md"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    />
                  )
                : renderHTML
                  ? (
                      <iframe
                        srcDoc={renderHTML}
                        title={String(preview.id)}
                        className="w-full h-[calc(100vh-180px)] rounded-md"
                        // 保守策略默认禁用脚本；抽取或禁用脚本时不授予脚本权限
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                      />
                    )
                  : (
                      <div className="w-full h-[calc(100vh-180px)] flex items-center justify-center text-sm op-60">
                        {renderError
                          ? (
                              <span>
                                渲染失败：
                                {renderError}
                                ，
                                <a className="color-primary" href={url} target="_blank" rel="noreferrer">在新标签打开</a>
                              </span>
                            )
                          : (
                              <span>正在渲染预览...</span>
                            )}
                      </div>
                    )
            )
          : (
              <iframe
                src={url}
                title={String(preview.id)}
                className="w-full h-[calc(100vh-180px)] rounded-md"
                referrerPolicy="no-referrer"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
              />
            )}
      </div>
    </div>
  )
}
