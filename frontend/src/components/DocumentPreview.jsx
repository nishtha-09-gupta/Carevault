import { Download, X } from 'lucide-react'

export default function DocumentPreview({ preview, onClose }) {
  if (!preview) return null
  const { document } = preview
  const kind = document.fileType === 'application/pdf' ? 'PDF' : document.fileType === 'image/jpeg' ? 'JPEG image' : 'PNG image'
  const date = new Date(document.uploadedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={`Document preview: ${document.title}`} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center gap-3 border-b border-slate-100 p-4"><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{document.title}</h2><p className="text-xs text-slate-500">{kind} · Uploaded {date}</p></div><a href={preview.url} download={document.originalFileName} className="btn-secondary !px-3 !py-2 text-xs"><Download size={14}/>Download</a><button type="button" aria-label="Close preview" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></header>
      <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">{document.fileType === 'application/pdf' ? <iframe title={`Preview of ${document.title}`} src={preview.url} className="h-[75vh] w-full rounded-lg bg-white"/> : <div className="grid h-[75vh] place-items-center overflow-auto"><img src={preview.url} alt={document.title} className="max-h-full max-w-full object-contain"/></div>}</div>
    </section>
  </div>
}
