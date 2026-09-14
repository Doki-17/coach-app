import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, History as HistoryIcon, MapPin, X, Menu, Image as ImageIcon, FileText } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getClient, getProgram, getHistory, restoreVersion, updateClient, type NewClientInput, type ProgramData, type ProgramVersion } from '../lib/storage';
import { displayProgramTitle } from '../lib/constants';
import { computeBMI, bmiCategory } from '../lib/health';
import { buildExportFilename } from '../lib/filename';
import ProgramSnapshotView from '../components/ProgramSnapshotView';
import ExportMenu from '../components/ExportMenu';
import ExportPreviewModal, { type ExportPreview } from '../components/ExportPreviewModal';
import ClientProfileModal from '../components/ClientProfileModal';

/** The hub page for a client: shows their current program, and lets a coach jump to editing, starting a new one, or the history/audit log. */
export default function ClientProgramView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clientId } = useParams();
  const printRef = useRef<HTMLDivElement>(null);

  const [client, setClient] = useState(() => (clientId ? getClient(clientId) : undefined));
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [program, setProgram] = useState<ProgramData | null>(() => (clientId ? getProgram(clientId) : null));
  const [history, setHistory] = useState<ProgramVersion[]>(() => (clientId ? getHistory(clientId) : []));
  const [showHistory, setShowHistory] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ProgramVersion | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);

  // Coming back here right after a Save in the editor - show a brief confirmation.
  const [showSavedBanner, setShowSavedBanner] = useState(
    () => Boolean((location.state as { justSaved?: boolean } | null)?.justSaved)
  );
  useEffect(() => {
    if (!showSavedBanner) return;
    const t = setTimeout(() => setShowSavedBanner(false), 2500);
    return () => clearTimeout(t);
  }, [showSavedBanner]);

  if (!clientId || !program) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <p className="text-gray-600">Client not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">Back to Dashboard</button>
      </div>
    );
  }

  const clientName = client?.nickname ?? 'Client';
  const fullName = client ? [client.firstName, client.lastName].filter(Boolean).join(' ') : '';
  const bmi = client ? computeBMI(client.weightKg, client.heightCm) : null;
  const hasSavedProgram = Boolean(client?.lastUpdated);

  const handleUpdateProfile = (input: NewClientInput) => {
    if (!clientId) return;
    const updated = updateClient(clientId, input);
    if (updated) setClient(updated);
    setShowEditProfile(false);
  };

  const handleRestore = (versionId: string) => {
    const ok = window.confirm('Restore this version as the current program? This will be logged as a new history entry.');
    if (!ok) return;
    const restored = restoreVersion(clientId, versionId);
    if (restored) {
      setProgram(restored);
      setHistory(getHistory(clientId));
      setShowHistory(false);
      setViewingVersion(null);
    }
  };

  const captureSnapshot = async () => {
    if (!printRef.current) return null;
    const width = printRef.current.offsetWidth;
    const height = printRef.current.offsetHeight;
    const dataUrl = await toPng(printRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
    return { dataUrl, width, height };
  };

  const handleExportPNG = async () => {
    try {
      const captured = await captureSnapshot();
      if (!captured) return;
      setExportPreview({ format: 'png', ...captured });
    } catch (err) {
      console.error('Error generating PNG', err);
    }
  };

  const handleExportPDF = async () => {
    try {
      const captured = await captureSnapshot();
      if (!captured) return;
      setExportPreview({ format: 'pdf', ...captured });
    } catch (err) {
      console.error('Error generating PDF', err);
    }
  };

  const handleConfirmExport = () => {
    if (!exportPreview) return;
    const { format, dataUrl, width, height } = exportPreview;
    if (format === 'png') {
      const link = document.createElement('a');
      link.download = buildExportFilename(clientName, program.title, 'png');
      link.href = dataUrl;
      link.click();
    } else {
      const pdf = new jsPDF({
        orientation: width >= height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(buildExportFilename(clientName, program.title, 'pdf'));
    }
    setExportPreview(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-2">
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {hasSavedProgram ? (
          <>
            {/* Desktop/tablet: the full row of actions. */}
            <div className="hidden sm:flex flex-wrap items-center gap-3">
              <button onClick={() => setShowHistory(true)} className="bg-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700">
                <HistoryIcon className="w-4 h-4" /> History{history.length > 0 ? ` (${history.length})` : ''}
              </button>
              <ExportMenu onExportPNG={handleExportPNG} onExportPDF={handleExportPDF} />
              <button onClick={() => navigate(`/client/${clientId}/new`)} className="bg-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700">
                <Plus className="w-4 h-4" /> New Program
              </button>
              <button onClick={() => navigate(`/client/${clientId}/edit`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                <Pencil className="w-4 h-4" /> Edit Program
              </button>
            </div>

            {/* Phones: the same actions collapse into a hamburger menu so this row
                doesn't wrap across two lines next to "Back to Dashboard". */}
            <div className="sm:hidden relative">
              <button
                onClick={() => setShowMobileMenu((o) => !o)}
                aria-label="Program actions"
                className="bg-white border border-gray-300 p-2.5 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>
              {showMobileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                    <button
                      onClick={() => { setShowMobileMenu(false); setShowHistory(true); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <HistoryIcon className="w-4 h-4" /> History{history.length > 0 ? ` (${history.length})` : ''}
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); handleExportPNG(); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" /> Download PNG
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); handleExportPDF(); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> Download PDF
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700" />
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate(`/client/${clientId}/new`); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> New Program
                    </button>
                    <button
                      onClick={() => { setShowMobileMenu(false); navigate(`/client/${clientId}/edit`); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4" /> Edit Program
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <button onClick={() => navigate(`/client/${clientId}/new`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Program
          </button>
        )}
      </div>

      {showSavedBanner && (
        <p className="text-sm text-green-600 font-medium mb-2">Saved &#10003; {clientName}'s program is up to date.</p>
      )}

      {/* Profile header - who this client is, at a glance - with the current program underneath. */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-gray-800 dark:border-gray-700 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{clientName}</h1>
            {fullName && <p className="text-sm text-gray-500 dark:text-gray-400">{fullName}</p>}
          </div>

          <div className="flex-1 flex flex-wrap justify-center gap-x-8 gap-y-2 min-w-[180px]">
            {client?.weightKg != null && (
              <div className="text-sm text-center">
                <span className="text-gray-400 dark:text-gray-500">Weight</span>
                <p className="font-medium text-gray-800 dark:text-gray-200">{client.weightKg} kg</p>
              </div>
            )}
            {client?.heightCm != null && (
              <div className="text-sm text-center">
                <span className="text-gray-400 dark:text-gray-500">Height</span>
                <p className="font-medium text-gray-800 dark:text-gray-200">{client.heightCm} cm</p>
              </div>
            )}
            {bmi != null && (
              <div className="text-sm text-center">
                <span className="text-gray-400 dark:text-gray-500">BMI</span>
                <p className="font-medium text-gray-800 dark:text-gray-200">
                  {bmi}{bmiCategory(bmi) ? ` (${bmiCategory(bmi)})` : ''}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {client?.location && (
              <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full dark:bg-gray-700 dark:text-gray-300 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {client.location}
              </span>
            )}
            <button
              onClick={() => setShowEditProfile(true)}
              className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1 dark:text-gray-400 dark:border-gray-600 flex items-center gap-1 hover:bg-gray-50"
            >
              <Pencil className="w-3 h-3" /> Edit Profile
            </button>
          </div>
        </div>

        {client?.remarks && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Notes / Remarks</span>
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{client.remarks}</p>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Current Program</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Use New Program to start a fresh one, or Edit Program to make changes to this one.
      </p>

      {hasSavedProgram ? (
        // Same reasoning as the editor's card: always render at full width so the
        // header never overlaps itself, scrolling horizontally on a narrow screen
        // instead of squishing.
        <div className="overflow-x-auto">
        <div ref={printRef} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-w-[960px] text-gray-900">
          <ProgramSnapshotView program={program} />
        </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400">
          <p className="mb-4">No program saved yet for {clientName}.</p>
          <button onClick={() => navigate(`/client/${clientId}/new`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-blue-700 mx-auto">
            <Plus className="w-4 h-4" /> Start a Program
          </button>
        </div>
      )}

      {showEditProfile && client && (
        <ClientProfileModal
          mode="edit"
          initial={client}
          onClose={() => setShowEditProfile(false)}
          onSubmit={handleUpdateProfile}
        />
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <HistoryIcon className="w-5 h-5" /> Program History
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No saved versions yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((v) => (
                  <li key={v.id} className="border border-gray-200 rounded-lg p-3 dark:border-gray-700">
                    <p className="text-sm font-semibold">{displayProgramTitle(v.program.title)}</p>
                    <p className="text-sm">{new Date(v.timestamp).toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mb-2">{v.note}</p>
                    <div className="flex gap-4">
                      <button onClick={() => setViewingVersion(v)} className="text-xs font-medium text-blue-600 hover:underline">
                        View
                      </button>
                      <button onClick={() => handleRestore(v.id)} className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline">
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {viewingVersion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setViewingVersion(null)}>
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[85vh] overflow-y-auto p-6 text-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-gray-500">
                Version from {new Date(viewingVersion.timestamp).toLocaleString()} &middot; {viewingVersion.note}
              </p>
              <div className="flex items-center gap-4">
                <button onClick={() => handleRestore(viewingVersion.id)} className="text-sm font-medium text-blue-600 hover:underline">
                  Restore this version
                </button>
                <button onClick={() => setViewingVersion(null)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Same reasoning as the current-program card: keep this at its full
                designed width so the header never overlaps itself - scroll
                horizontally to see the rest on a narrow screen. */}
            <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <ProgramSnapshotView program={viewingVersion.program} />
            </div>
            </div>
          </div>
        </div>
      )}

      {exportPreview && (
        <ExportPreviewModal
          preview={exportPreview}
          filename={buildExportFilename(clientName, program.title, exportPreview.format)}
          onConfirm={handleConfirmExport}
          onClose={() => setExportPreview(null)}
        />
      )}
    </div>
  );
}
