import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { CATEGORY_TYPES } from '../lib/categoryTypes';
import { getCategoryVisual } from '../lib/categoryVisuals';

/**
 * Button + dropdown for adding a new program category. The coach picks which
 * kind of category it is up front (Running, Workout, HYROX) - that choice
 * decides the exercise table's columns, so it can't be changed after the
 * fact in this first version.
 */
export default function AddCategoryMenu({ onAdd }: { onAdd: (categoryTypeId: string) => void }) {
  const [open, setOpen] = useState(false);
  // This button lives at the bottom of the category list, so a menu that
  // always drops down tends to spill past the viewport edge. Decide the
  // direction fresh each time it opens, based on how much room is actually
  // left below it.
  const [openUpward, setOpenUpward] = useState(false);
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

  const toggleOpen = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const estimatedMenuHeight = CATEGORY_TYPES.length * 44 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < estimatedMenuHeight);
    }
    setOpen((o) => !o);
  };

  return (
    <div className="exclude-from-png relative mt-8" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 font-medium w-full justify-center border border-gray-300"
      >
        <Plus className="w-5 h-5" /> Add New Category <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className={`absolute z-10 w-full bg-off-white border border-gray-200 rounded-lg shadow-lg overflow-hidden ${openUpward ? 'bottom-full mb-1' : 'mt-1'}`}>
          {CATEGORY_TYPES.map((type) => {
            const visual = getCategoryVisual(type.id);
            return (
              <button
                key={type.id}
                onClick={() => {
                  onAdd(type.id);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3"
              >
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${visual.iconBg}`}>
                  <visual.Icon className={`w-3.5 h-3.5 ${visual.iconText}`} />
                </span>
                {type.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
