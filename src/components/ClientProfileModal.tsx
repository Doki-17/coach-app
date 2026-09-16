import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { computeBMI } from '../lib/health';
import type { Client, NewClientInput } from '../lib/storage';

interface ClientProfileModalProps {
  /** "create" for the New Client flow, "edit" for updating an existing client's profile. */
  mode: 'create' | 'edit';
  /** Pre-fills the form when editing an existing client. */
  initial?: Client;
  onClose: () => void;
  onSubmit: (input: NewClientInput) => void;
}

const fieldClass = "w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-off-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-600";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

/** Modal form for creating a new client, or editing an existing one's profile. Only nickname is required. */
export default function ClientProfileModal({ mode, initial, onClose, onSubmit }: ClientProfileModalProps) {
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [weight, setWeight] = useState(initial?.weightKg != null ? String(initial.weightKg) : '');
  const [height, setHeight] = useState(initial?.heightCm != null ? String(initial.heightCm) : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');

  const weightKg = weight.trim() ? Number(weight) : null;
  const heightCm = height.trim() ? Number(height) : null;
  const bmi = computeBMI(weightKg, heightCm);
  const canSubmit = nickname.trim().length > 0;

  const heading = mode === 'create' ? 'New Client' : 'Edit Client Profile';
  const submitLabel = mode === 'create' ? 'Create Client' : 'Save Changes';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      nickname,
      email,
      firstName,
      lastName,
      weightKg: weightKg && !Number.isNaN(weightKg) ? weightKg : null,
      heightCm: heightCm && !Number.isNaN(heightCm) ? heightCm : null,
      location,
      remarks,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-off-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto dark:bg-gray-800"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{heading}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Nickname <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What do you call them?"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Client's Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="So you know where to send their invite link"
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Last Name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>First Name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Weight (kg)</label>
              <input type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Height (cm)</label>
              <input type="number" min="0" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {bmi != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              BMI: <span className="font-medium text-gray-700 dark:text-gray-300">{bmi}</span>
            </p>
          )}

          <div>
            <label className={labelClass}>Gym / Training Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gold's Gym BGC, or client's home"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Anything worth noting - injuries, goals, preferences..."
              className={`${fieldClass} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
