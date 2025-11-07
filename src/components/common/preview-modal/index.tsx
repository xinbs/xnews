import { useAtom } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { previewItemAtom } from "~/atoms/preview"
import { myFetch } from "~/utils"

/**
 * 站点通常会禁止被 iframe 嵌入，统一通过 /api/render 做代理。
 * - 默认禁用第三方脚本，提供开关启用；
 * - 支持“阅读模式（抽取）”以纯正文展示；
 */
export function PreviewModal() {
  const [item, setItem] = useAtom(previewItemAtom)
  const url = useMemo(() => (item?.mobileUrl || item?.url || ""), [item])
  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return ""
    }
  }, [url])

  const blockedPreviewHosts = new Set([
    "www.toutiao.com",
    "toutiao.com",
    "www.zhihu.com",
    "zhihu.com",
    "weibo.com",
    "www.weibo.com",
  ])
  const useRenderProxy = blockedPreviewHosts.has(hostname)

  const [renderHTML, setRenderHTML] = useState<string>("")
  const [renderError, setRenderError] = useState<string>("")
  const [allowScripts, setAllowScripts] = useState<boolean>(false)
  const [useExtractMode, setUseExtractMode] = useState<boolean>(false)

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

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-neutral-900/50" onClick={() => setItem(null)} />

      {/* 弹窗内容 */}
      <div className={$([
        "absolute right-4 bottom-4 w-[min(900px,90vw)] h-[min(70vh,700px)]",
        "rounded-xl shadow-xl bg-neutral-50 dark:bg-neutral-900 border border-base",
        "flex flex-col",
      ])}
      >
        <div className="px-3 py-2 border-b border-base flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{item.title}</h2>
            <div className="text-xs op-60 truncate">
              {item.extra?.info || item.extra?.hover || hostname}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {useRenderProxy && (
              <label className="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" className="cursor-pointer" checked={allowScripts} onChange={e => setAllowScripts(e.target.checked)} />
                允许脚本预览
              </label>
            )}
            {useRenderProxy && (
              <label className="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" className="cursor-pointer" checked={useExtractMode} onChange={e => setUseExtractMode(e.target.checked)} />
                阅读模式
              </label>
            )}
            <a className="btn btn-ghost text-xs" href={item.url} target="_blank" rel="noreferrer">原文</a>
            <button type="button" className="btn i-ph:x-duotone" onClick={() => setItem(null)} />
          </div>
        </div>

        <div className="flex-1 p-2">
          {useRenderProxy
            ? (
                allowScripts && renderEndpoint
                  ? (
                      <iframe
                        src={renderEndpoint}
                        title={String(item.id)}
                        className="w-full h-full rounded-md"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      />
                    )
                  : renderHTML
                    ? (
                        <iframe
                          srcDoc={renderHTML}
                          title={String(item.id)}
                          className="w-full h-full rounded-md"
                          sandbox="allow-popups allow-popups-to-escape-sandbox"
                        />
                      )
                    : (
                        <div className="w-full h-full flex items-center justify-center text-sm op-60">
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
                  title={String(item.id)}
                  className="w-full h-full rounded-md"
                  referrerPolicy="no-referrer"
                />
              )}
        </div>
      </div>
    </div>
  )
}
