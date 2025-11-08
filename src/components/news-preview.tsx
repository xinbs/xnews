import type { NewsItem } from "@shared/types"
import { useSetAtom } from "jotai"
import { previewItemAtom } from "~/atoms/preview"

interface NewsPreviewProps {
  item: NewsItem
  children: React.ReactNode
}

export function NewsPreview({ item, children }: NewsPreviewProps) {
  const setPreviewItem = useSetAtom(previewItemAtom)

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPreviewItem(item)
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      {children}
      <button
        type="button"
        className="btn i-ph:eye-duotone text-sm opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={handlePreview}
        title="预览新闻内容"
      />
    </div>
  )
}
