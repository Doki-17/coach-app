import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getRole, type Role } from '../lib/auth';

/**
 * Route guard: if nobody's "logged in" (no role picked on the Login page),
 * bounce to /login. If `allow` is given, also bounce when the current role
 * isn't one of the allowed ones (e.g. a client hitting a coach-only route).
 *
 * This is intentionally simple - see lib/auth.ts for why.
 */
export default function ProtectedRoute({ allow, children }: { allow?: Role[]; children: ReactNode }) {
  const location = useLocation();
  const role = getRole();

  if (!role || (allow && !allow.includes(role))) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
