import { useState } from 'react';
import { Download, ChevronDown, Image as ImageIcon, FileText } from 'lucide-react';

interface ExportMenuProps {
  onExportPNG: () => void;
  onExportPDF: () => void;
}

/** A single "Export" button that opens a small choice between PNG and PDF. */
export default function ExportMenu({ onExportPNG, onExportPDF }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-off-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
      >
        <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          {/* Backdrop to close the menu on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-off-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => { setOpen(false); onExportPNG(); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4" /> Download PNG
            </button>
            <button
              onClick={() => { setOpen(false); onExportPDF(); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
