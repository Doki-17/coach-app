import { AlertTriangle } from 'lucide-react';

/**
 * Guards against leaving the program editor with unsaved changes - shown
 * when a coach tries to navigate away (currently: the "Back to <client>"
 * button) while the program differs from what was last loaded/saved.
 */
export default function UnsavedChangesModal({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-off-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-2">
          <span className="shrink-0 w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </span>
          <h2 className="text-lg font-bold pt-1.5 text-gray-900 dark:text-gray-100">Unsaved changes</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          This program has changes that haven't been saved yet. Save them before leaving, or discard them?
        </p>
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Keep Editing
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
