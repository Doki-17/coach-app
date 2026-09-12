import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { CATEGORY_TYPES } from '../lib/categoryTypes';

/**
 * Button + dropdown for adding a new program category. The coach picks which
 * kind of category it is up front (Bodybuilding, HIIT, Circuit Training,
 * Cardio, Yoga/Mobility) - that choice decides the exercise table's columns,
 * so it can't be changed after the fact in this first version.
 */
export default function AddCategoryMenu({ onAdd }: { onAdd: (categoryTypeId: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="exclude-from-png relative mt-8" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 font-medium w-full justify-center border border-gray-300"
      >
        <Plus className="w-5 h-5" /> Add New Category <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {CATEGORY_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                onAdd(type.id);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              {type.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
