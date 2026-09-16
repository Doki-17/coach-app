import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { setRole, signIn, signUp, getMyRole, type Role } from '../lib/auth';

const fieldClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-off-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600';

const routeFor = (role: Role) => (role === 'coach' ? '/' : '/client-home');

/**
 * Sign in works here for BOTH coaches and clients - after a successful
 * sign-in we look up the account's actual role (getMyRole) and route
 * accordingly, rather than trusting anything picked on this page. Sign UP
 * here, though, only ever creates a coach account - a client's first-ever
 * account is created through their personal invite link instead (see
 * ClientProgramView's "Copy Invite Link" button and pages/InvitePage.tsx),
 * which is what ties that account to a specific client profile. Once a
 * client has done that once, they can come back and sign in right here
 * like anyone else.
 */
export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(false);

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setConfirmNotice(false);
    setConfirmPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmNotice(false);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { confirmedImmediately } = await signUp(email, password, 'coach', firstName, lastName);
        if (confirmedImmediately) {
          setRole('coach');
          navigate('/', { replace: true });
        } else {
          setConfirmNotice(true);
        }
      } else {
        await signIn(email, password);
        const role = await getMyRole();
        setRole(role);
        navigate(routeFor(role), { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">Coach App</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          {mode === 'signin' ? 'Sign in to continue' : 'Create your coach account'}
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
            <p className="text-sm text-green-600">Check your email to confirm your account, then sign in.</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 justify-center bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>

        {mode === 'signup' && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            Coaching client? Signing up here creates a coach account - use the invite link your coach sent you instead.
          </p>
        )}
      </div>
    </div>
  );
}
