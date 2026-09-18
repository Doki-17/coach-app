import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LogOut, Pencil, Plus, History as HistoryIcon, MapPin, X, Menu, Image as ImageIcon, FileText, Link2, Check, ChevronDown, Bell, Settings, AlertTriangle } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getClient, getProgram, getHistory, restoreVersion, updateClient, setClientStatus, buildInviteUrl, getNotifications, markNotificationsRead, updateNotificationSettings, type Client, type NewClientInput, type ProgramData, type ProgramVersion, type ClientNotification } from '../../../lib/storage';
import { displayProgramTitle } from '../../../lib/constants';
import { computeBMI, bmiCategory } from '../../../lib/health';
import { buildExportFilename } from '../../../lib/filename';
import { getRole, logout } from '../../../lib/auth';
import ProgramSnapshotView from '../../../components/ProgramSnapshotView';
import ProgramCardView from '../../../components/ProgramCardView';
import ExportMenu from '../../../components/ExportMenu';
import ExportPreviewModal, { type ExportPreview } from '../../../components/ExportPreviewModal';
import ClientProfileModal from '../../../components/ClientProfileModal';

/**
 * The hub page for a client: shows their profile and current program.
 * A coach gets the full toolset here (edit, start new, history/audit log).
 * A client gets a read-only version of the same page - same profile, same
 * program, same download options - with every editing/history action
 * hidden (see lib/auth.ts for how the role is determined for now).
 */
export default function ClientProgramView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clientId } = useParams();
  const printRef = useRef<HTMLDivElement>(null);

  const isCoach = getRole() === 'coach';

  const handleClientLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const [client, setClient] = useState<Client | undefined>(undefined);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [history, setHistory] = useState<ProgramVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ProgramVersion | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);

  // Coming back here right after a Save in the editor - show a brief confirmation.
  const [showSavedBanner, setShowSavedBanner] = useState(
    () => Boolean((location.state as { justSaved?: boolean } | null)?.justSaved)
  );
  useEffect(() => {
    if (!showSavedBanner) return;
    const t = setTimeout(() => setShowSavedBanner(false), 2500);
    return () => clearTimeout(t);
  }, [showSavedBanner]);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getClient(clientId), getProgram(clientId), getHistory(clientId)])
      .then(([c, p, h]) => {
        if (cancelled) return;
        setClient(c);
        setProgram(p);
        setHistory(h);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load client.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Notifications are client-only (a coach previewing this page doesn't need
  // them) and non-critical - a failure here should never block the program
  // view itself, so it's a separate effect with its own quiet failure mode.
  useEffect(() => {
    if (isCoach || !clientId) return;
    let cancelled = false;
    getNotifications(clientId)
      .then((data) => {
        if (!cancelled) setNotifications(data);
      })
      .catch((err) => console.error('Failed to load notifications', err));
    return () => {
      cancelled = true;
    };
  }, [isCoach, clientId]);

  if (!clientId) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <p className="text-gray-600">Client not found.</p>
        {isCoach ? (
          <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">
            Back to Dashboard
          </button>
        ) : (
          <button onClick={handleClientLogout} className="mt-4 text-blue-600 hover:underline">
            Log out
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (loadError || !program) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <p className="text-gray-600 dark:text-gray-400">{loadError ?? 'Client not found.'}</p>
        {isCoach ? (
          <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline">
            Back to Dashboard
          </button>
        ) : (
          <button onClick={handleClientLogout} className="mt-4 text-blue-600 hover:underline">
            Log out
          </button>
        )}
      </div>
    );
  }

  const clientName = client?.nickname ?? 'Client';
  const fullName = client ? [client.firstName, client.lastName].filter(Boolean).join(' ') : '';
  const bmi = client ? computeBMI(client.weightKg, client.heightCm) : null;
  const hasSavedProgram = Boolean(client?.lastUpdated);
  const isInactive = client?.status === 'inactive';
  // A coach still sees everything regardless of status - only the client's
  // own view of their current program is hidden while inactive (their full
  // history stays intact for the coach either way, nothing here is deleted).
  const clientProgramHidden = !isCoach && isInactive;
  const showCurrentProgram = hasSavedProgram && !clientProgramHidden;

  const unreadNotificationCount = notifications.filter((n) => !n.readAt).length;

  // Opening the bell is what counts as "seen" - matches marking everything
  // read right away rather than waiting for each notification to be
  // individually dismissed.
  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    // Always land on the notification list, not wherever settings were left.
    setShowNotificationSettings(false);
    if (unreadNotificationCount === 0 || !clientId) return;
    try {
      await markNotificationsRead(clientId);
      setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    }
  };

  const handleToggleEmailNotifications = async () => {
    if (!client || savingNotificationSettings) return;
    const nextEnabled = !client.notificationSettings.emailEnabled;
    const previous = client;
    setClient({ ...client, notificationSettings: { emailEnabled: nextEnabled } });
    setSavingNotificationSettings(true);
    try {
      await updateNotificationSettings(nextEnabled);
    } catch (err) {
      console.error('Failed to update notification settings', err);
      setClient(previous);
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!client) return;
    await navigator.clipboard.writeText(buildInviteUrl(client));
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleUpdateProfile = async (input: NewClientInput) => {
    if (!clientId) return;
    const updated = await updateClient(clientId, input);
    if (updated) setClient(updated);
    setShowEditProfile(false);
  };

  const handleReactivate = async () => {
    if (!clientId) return;
    const updated = await setClientStatus(clientId, 'active');
    if (updated) setClient(updated);
  };

  const handleRestore = async (versionId: string) => {
    if (!clientId) return;
    const ok = window.confirm('Restore this version as the current program? This will be logged as a new history entry.');
    if (!ok) return;
    const restored = await restoreVersion(clientId, versionId);
    if (restored) {
      setProgram(restored);
      setHistory(await getHistory(clientId));
      setShowHistory(false);
      setViewingVersion(null);
    }
  };

  const captureSnapshot = async () => {
    if (!printRef.current) return null;
    const width = printRef.current.offsetWidth;
    const height = printRef.current.offsetHeight;
    const dataUrl = await toPng(printRef.current, { cacheBust: true, backgroundColor: '#f8f9fa' });
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
    <div className="max-w-7xl mx-auto p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-8 sm:mb-6">
        {isCoach ? (
          <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        ) : (
          // A client only ever has access to their own program - there's no "back" to
          // anywhere else, so this spot is a logout instead of a dead-end Back button.
          <button onClick={handleClientLogout} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        )}

        {isCoach ? (
          hasSavedProgram ? (
            <>
              {/* Desktop/tablet: the full row of actions. */}
              <div className="hidden sm:flex flex-wrap items-center gap-3">
                <button onClick={() => setShowHistory(true)} className="bg-off-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700">
                  <HistoryIcon className="w-4 h-4" /> History{history.length > 0 ? ` (${history.length})` : ''}
                </button>
                <ExportMenu onExportPNG={handleExportPNG} onExportPDF={handleExportPDF} />
                {!isInactive && (
                  <>
                    <button onClick={() => navigate(`/client/${clientId}/new`)} className="bg-off-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700">
                      <Plus className="w-4 h-4" /> New Program
                    </button>
                    <button onClick={() => navigate(`/client/${clientId}/edit`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                      <Pencil className="w-4 h-4" /> Edit Program
                    </button>
                  </>
                )}
              </div>

              {/* Phones: the same actions collapse into a hamburger menu so this row
                  doesn't wrap across two lines next to "Back to Dashboard". */}
              <div className="sm:hidden relative">
                <button
                  onClick={() => setShowMobileMenu((o) => !o)}
                  aria-label="Program actions"
                  className="bg-off-white border border-gray-300 p-2.5 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  <Menu className="w-5 h-5" />
                </button>
                {showMobileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-off-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
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
                      {!isInactive && (
                        <>
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
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : !isInactive ? (
            <button onClick={() => navigate(`/client/${clientId}/new`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Program
            </button>
          ) : null
        ) : (
          // Client role: view-only. Notification bell plus the same download options as the coach gets.
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenNotifications}
              aria-label="Notifications"
              className="relative bg-off-white border border-gray-300 p-2.5 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
            {showCurrentProgram && <ExportMenu onExportPNG={handleExportPNG} onExportPDF={handleExportPDF} />}
          </div>
        )}
      </div>

      {showSavedBanner && (
        <p className="text-sm text-green-600 font-medium mb-4">Saved &#10003; {clientName}'s program is up to date.</p>
      )}

      {isCoach && isInactive && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{clientName} is inactive</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              View only - {clientName} can&apos;t see their program right now. Past programs below are untouched;
              reactivate to make changes or start a new one.
            </p>
          </div>
          <button
            onClick={handleReactivate}
            className="shrink-0 text-sm font-medium bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 self-start"
          >
            Reactivate
          </button>
        </div>
      )}

      {/* Profile header - who this client is, at a glance. Collapsed by default on
          both web and mobile - the name and (for a coach) the profile actions stay
          visible either way; the chevron reveals vitals/location/remarks. Same
          component for both roles, so this behavior applies to the coach's view
          and the client's own view alike. */}
      <div className="bg-off-white rounded-xl border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700 mb-10 sm:mb-8">
        {/* Stacked on mobile for a coach - their extra two buttons (Copy Invite
            Link, Edit Profile) next to the name left almost no room for either on
            a phone, squeezing the name down to a couple of truncated characters.
            Full width on its own row, name and actions both get to breathe. A
            client only ever has the single chevron button here, which fits fine
            beside the name at any width, so their row never needs to stack - the
            chevron stays on the side instead of dropping below the name. */}
        <div
          className={`flex gap-3 sm:gap-4 ${
            isCoach ? 'flex-col sm:flex-row sm:items-center sm:justify-between' : 'flex-row items-center justify-between'
          }`}
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{clientName}</h1>
            {fullName && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{fullName}</p>}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:justify-end">
            {isCoach && client && (
              <button
                onClick={handleCopyInviteLink}
                title={client.inviteClaimedAt ? 'Client has already signed in with this link' : "Client hasn't signed in yet"}
                className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1 dark:text-gray-400 dark:border-gray-600 flex items-center gap-1 hover:bg-gray-50"
              >
                {inviteCopied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                {inviteCopied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            )}
            {isCoach && (
              <button
                onClick={() => setShowEditProfile(true)}
                className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1 dark:text-gray-400 dark:border-gray-600 flex items-center gap-1 hover:bg-gray-50"
              >
                <Pencil className="w-3 h-3" /> Edit Profile
              </button>
            )}
            <button
              onClick={() => setProfileExpanded((v) => !v)}
              aria-expanded={profileExpanded}
              aria-label={profileExpanded ? 'Hide profile details' : 'Show profile details'}
              className="text-gray-400 border border-gray-300 rounded-lg p-1.5 dark:text-gray-500 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${profileExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className={`grid transition-all duration-300 ease-in-out ${profileExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-5 mt-5 border-t border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-3 gap-3 sm:flex-1 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-3">
                {client?.weightKg != null && (
                  <div className="text-sm text-center sm:text-left">
                    <span className="text-gray-400 dark:text-gray-500">Weight</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{client.weightKg} kg</p>
                  </div>
                )}
                {client?.heightCm != null && (
                  <div className="text-sm text-center sm:text-left">
                    <span className="text-gray-400 dark:text-gray-500">Height</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{client.heightCm} cm</p>
                  </div>
                )}
                {bmi != null && (
                  <div className="text-sm text-center sm:text-left">
                    <span className="text-gray-400 dark:text-gray-500">BMI</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {bmi}{bmiCategory(bmi) ? ` (${bmiCategory(bmi)})` : ''}
                    </p>
                  </div>
                )}
              </div>

              {client?.location && (
                <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full dark:bg-gray-700 dark:text-gray-300 flex items-center gap-1 shrink-0">
                  <MapPin className="w-3 h-3" /> {client.location}
                </span>
              )}
            </div>

            {client?.remarks && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Notes / Remarks</span>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{client.remarks}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Current Program</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 sm:mb-6">
        {isCoach
          ? isInactive
            ? 'View only while inactive - reactivate to start a new program or make changes.'
            : 'Use New Program to start a fresh one, or Edit Program to make changes to this one.'
          : 'View-only - reach out to your coach to make changes.'}
      </p>

      {showCurrentProgram ? (
        <>
            {/* Phones: a stack of cards instead of the wide table below - much easier to
                scan without pinch-zooming or scrolling sideways through a 960px table.
                Now shown for a coach too (not just a client) - the History/Export/New/Edit
                actions above still work the same regardless of which layout renders the
                program itself below them; a coach who wants to change something taps
                Edit Program, same as always, and lands in the phone-friendly editor. */}
            <div className="sm:hidden">
              <ProgramCardView program={program} hideCompletedWeeks={!isCoach} />
            </div>

            {/* Tablet/desktop: the original table, unchanged. Same reasoning as the
                editor's card: always render at full width so the header never overlaps
                itself, scrolling horizontally on a narrow screen instead of squishing. */}
            <div className="hidden sm:block overflow-x-auto">
              <div className="bg-off-white p-8 rounded-xl shadow-sm border border-gray-200 min-w-[960px] text-gray-900">
                <ProgramSnapshotView program={program} hideCompletedWeeks={!isCoach} />
              </div>
            </div>

            {/* Always rendered - off-screen, never shown - regardless of which of the two
                above is visible. This is the node PNG/PDF export actually captures, so a
                download always looks like the table above, never the phone cards, no
                matter what device it was downloaded from. */}
            <div className="fixed top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div ref={printRef} className="bg-off-white p-8 rounded-xl shadow-sm border border-gray-200 min-w-[960px] text-gray-900">
                <ProgramSnapshotView program={program} hideCompletedWeeks={!isCoach} />
              </div>
            </div>
          </>
      ) : (
        <div className="bg-off-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400">
          <p className={isCoach ? 'mb-4' : ''}>
            {isCoach
              ? `No program saved yet for ${clientName}.`
              : clientProgramHidden
                ? "Your program isn't available right now. Check back soon or reach out to your coach."
                : 'No program saved yet. Check back soon.'}
          </p>
          {isCoach && !isInactive && (
            <button onClick={() => navigate(`/client/${clientId}/new`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-blue-700 mx-auto">
              <Plus className="w-4 h-4" /> Start a Program
            </button>
          )}
        </div>
      )}

      {isCoach && showEditProfile && client && (
        <ClientProfileModal
          mode="edit"
          initial={client}
          onClose={() => setShowEditProfile(false)}
          onSubmit={handleUpdateProfile}
        />
      )}

      {isCoach && showHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="bg-off-white w-full max-w-md h-full overflow-y-auto p-6 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
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
                      {!isInactive && (
                        <button onClick={() => handleRestore(v.id)} className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:underline">
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Always mounted (for any client) rather than conditionally rendered on
          showNotifications, so the open/close transform below actually has
          something to transition between instead of popping in/out instantly. */}
      {!isCoach && (
        <div
          className={`fixed inset-0 bg-black/40 z-50 flex justify-end transition-opacity duration-300 ${
            showNotifications ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setShowNotifications(false)}
        >
          <div
            className={`bg-off-white w-full max-w-md h-full overflow-y-auto p-6 dark:bg-gray-900 transform transition-transform duration-300 ease-out ${
              showNotifications ? 'translate-x-0' : 'translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {showNotificationSettings ? (
                  <button
                    onClick={() => setShowNotificationSettings(false)}
                    aria-label="Back to notifications"
                    className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 -ml-1"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                ) : (
                  <Bell className="w-5 h-5" />
                )}
                {showNotificationSettings ? 'Notification Settings' : 'Notifications'}
              </h3>
              <div className="flex items-center gap-2">
                {!showNotificationSettings && (
                  <button
                    onClick={() => setShowNotificationSettings(true)}
                    aria-label="Notification settings"
                    className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {showNotificationSettings ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Email notifications</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Get an email when your coach updates your program. Coming soon - turning this on saves your
                      preference now, but emails aren&apos;t sent yet.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={client?.notificationSettings.emailEnabled ?? false}
                    aria-label="Toggle email notifications"
                    onClick={handleToggleEmailNotifications}
                    disabled={!client || savingNotificationSettings}
                    className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      client?.notificationSettings.emailEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        client?.notificationSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`border rounded-lg p-3 ${
                      n.readAt
                        ? 'border-gray-200 dark:border-gray-700'
                        : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    }`}
                  >
                    <p className="text-sm text-gray-800 dark:text-gray-200">{n.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isCoach && viewingVersion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setViewingVersion(null)}>
          <div className="bg-off-white rounded-xl max-w-5xl w-full max-h-[85vh] overflow-y-auto p-6 text-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-gray-500">
                Version from {new Date(viewingVersion.timestamp).toLocaleString()} &middot; {viewingVersion.note}
              </p>
              <div className="flex items-center gap-4">
                {!isInactive && (
                  <button onClick={() => handleRestore(viewingVersion.id)} className="text-sm font-medium text-blue-600 hover:underline">
                    Restore this version
                  </button>
                )}
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
