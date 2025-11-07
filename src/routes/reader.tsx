import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/reader")({
  component: ReaderPage,
})

function ReaderPage() {
  const [allowScripts, setAllowScripts] = useState(false)
  const [useExtractMode, setUseExtractMode] = useState(false)
  const [renderHTML, setRenderHTML] = useState<string>("")
  const [renderEndpoint, setRenderEndpoint] = useState<string>("")
  const [renderError, setRenderError] = useState<string>("")
  const [probeBlocked, setProbeBlocked] = useState<boolean | null>(null)

  const searchParams = new URLSearchParams(globalThis.location?.search || "")
  const url = searchParams.get("url") || ""

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return ""
    }
  }, [url])

  useEffect(() => {
    setProbeBlocked(null)
    setRenderHTML("")
    setRenderEndpoint("")
    setRenderError("")
  }, [url])

  useEffect(() => {
    if (!url) return
    const q = new URLSearchParams()
    q.set("url", encodeURIComponent(url))
    fetch(`/api/probe/frame?${q.toString()}`)
      .then(r => r.json())
      .then((ret) => {
        setProbeBlocked(Boolean(ret?.blocked))
      })
      .catch(() => setProbeBlocked(true))
  }, [url])

  const useRenderProxy = probeBlocked === true

  useEffect(() => {
    if (!useRenderProxy || !url) return
    const q = new URLSearchParams()
    q.set("url", encodeURIComponent(url))
    if (allowScripts) q.set("scripts", "1")
    if (useExtractMode) q.set("mode", "extract")
    setRenderEndpoint(`/api/render?${q.toString()}`)
    fetch(`/api/render?${q.toString()}`)
      .then(r => r.text())
      .then((html) => {
        setRenderHTML(html)
      })
      .catch(e => setRenderError(String(e?.message || e)))
  }, [useRenderProxy, url, allowScripts, useExtractMode])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          className="px-2 py-1 w-[520px] border rounded"
          value={url}
          readOnly
        />
        <button type="button" className="btn" onClick={() => setAllowScripts(v => !v)}>
          {allowScripts ? "禁用脚本" : "允许脚本"}
        </button>
        <button type="button" className="btn" onClick={() => setUseExtractMode(v => !v)}>
          {useExtractMode ? "关闭抽取模式" : "开启抽取模式"}
        </button>
        {url && (
          <a className="color-primary" href={url} target="_blank" rel="noreferrer">新标签打开</a>
        )}
      </div>
      <div className="w-full h-[70vh] border rounded-md overflow-hidden">
        {useRenderProxy
          ? (
              allowScripts && renderEndpoint
                ? (
                    <iframe
                      src={renderEndpoint}
                      title={hostname || "reader"}
                      className="w-full h-full"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    />
                  )
                : renderHTML
                  ? (
                      <iframe
                        srcDoc={renderHTML}
                        title={hostname || "reader"}
                        className="w-full h-full"
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
                title={hostname || "reader"}
                className="w-full h-full"
                referrerPolicy="no-referrer"
              />
            )}
      </div>
    </div>
  )
}
