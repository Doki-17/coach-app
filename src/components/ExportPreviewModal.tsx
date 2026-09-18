import { X, Download } from 'lucide-react';

export interface ExportPreview {
  format: 'png' | 'pdf';
  dataUrl: string;
  width: number;
  height: number;
}

/** Shows what an export will look like before it actually saves a file, so a coach can back out instead of downloading the wrong thing. */
export default function ExportPreviewModal({
  preview,
  filename,
  onConfirm,
  onClose,
}: {
  preview: ExportPreview;
  filename: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-off-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold">Preview before downloading</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{filename}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto border border-gray-200 rounded-lg bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <img src={preview.dataUrl} alt="Export preview" className="w-full h-auto rounded shadow-sm" />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={onConfirm} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Download className="w-4 h-4" /> Download {preview.format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
