import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyClientProfile } from '../../../lib/storage';

/**
 * Landing page for a signed-in client account. Looks up the client profile
 * linked to this account (already claimed via their invite link - see
 * pages/InvitePage.tsx and storage.ts#claimInvite) and redirects straight
 * into that profile's program view if found. A client only ever reaches
 * /client-home right after a successful claim, so "not found" here
 * normally means something odd happened in between.
 */
export default function ClientHome() {
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyClientProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          navigate(`/client/${profile.id}`, { replace: true });
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 min-h-screen flex flex-col justify-center text-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 min-h-screen flex flex-col justify-center text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No program is linked to this account yet. Ask your coach for your invite link.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 min-h-screen flex flex-col justify-center text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
    </div>
  );
}
