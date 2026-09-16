import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { setRole, signIn, signUp, logout } from '../lib/auth';
import { claimInvite } from '../lib/storage';

const fieldClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-off-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600';

/**
 * A client's personal sign-up/sign-in page - the ONLY way a client account
 * gets created or signed back into (see pages/Login.tsx, which is
 * coach-only now). The :token in the URL comes from a specific client's
 * "Copy Invite Link" button (see ClientProgramView) and is what
 * claimInvite() uses to link this Supabase Auth account to that one
 * client profile - see the `claim_invite` Postgres function and
 * `clients.invite_token` in the schema.
 *
 * First-time use: the client signs up here. Every time after that, they
 * come back to this same link to sign in - claimInvite is safe to call
 * again for an account that already claimed this profile (a no-op), so
 * sign-in works the same way as first-time sign-up.
 */
export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(false);

  const switchMode = (next: 'signup' | 'signin') => {
    setMode(next);
    setError(null);
    setConfirmNotice(false);
    setConfirmPassword('');
  };

  const finishClaim = async () => {
    if (!token) return;
    await claimInvite(token);
    setRole('client');
    navigate('/client-home', { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmNotice(false);

    if (!token) {
      setError('This invite link looks incomplete. Ask your coach to resend it.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { confirmedImmediately } = await signUp(email, password, 'client', firstName, lastName);
        if (confirmedImmediately) {
          await finishClaim();
        } else {
          setConfirmNotice(true);
        }
      } else {
        await signIn(email, password);
        await finishClaim();
      }
    } catch (err) {
      // Covers both auth errors and claimInvite() rejecting an invalid/already-claimed-
      // by-someone-else token - either way, don't leave them signed in with no profile.
      await logout().catch(() => {});
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This invite link looks incomplete. Ask your coach to resend it.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">You're Invited</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          {mode === 'signup' ? 'Set up your account to see your program.' : 'Sign in to see your program.'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                className={fieldClass}
              />
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className={fieldClass}
              />
            </div>
          )}

          <input
            type="email"
            required
            autoFocus={mode === 'signin'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={fieldClass}
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={fieldClass}
          />
          {mode === 'signup' && (
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className={fieldClass}
            />
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          {confirmNotice && (
            <p className="text-sm text-green-600">
              Check your email to confirm your account, then come back to this same link to sign in.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 justify-center bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
          className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {mode === 'signup' ? 'Already set up your account? Sign in' : "Haven't signed up yet? Create your account"}
        </button>
      </div>
    </div>
  );
}
