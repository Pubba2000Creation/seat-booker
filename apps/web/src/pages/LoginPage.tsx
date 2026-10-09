import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { FormError } from '../components/ui/States';
import { asApiError } from '../lib/api-error';

interface LocationState {
  readonly from?: string;
}

/**
 * The only public page.
 *
 * There is no signup link, deliberately: the first admin is seeded and admins create every
 * other account (§2). A "create an account" affordance would be a dead end.
 *
 * The API returns one generic message for both an unknown email and a wrong password, so
 * this form shows it verbatim without trying to guess which field was wrong — telling a
 * stranger which emails exist is exactly what that rule avoids.
 */
export function LoginPage(): ReactElement {
  const { status, login } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already signed in: go where they were headed, or let the role redirect decide.
  if (status === 'authenticated') {
    const state = location.state as LocationState | null;
    return <Navigate to={state?.from ?? '/'} replace />;
  }

  const fieldErrors = asApiError(error)?.fieldErrors() ?? {};

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    // Guards against a double submit from a fast second click or an Enter key repeat.
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // The email is normalised server-side too; trimming here stops a trailing space
      // from looking like a wrong password.
      await login({ email: email.trim().toLowerCase(), password });
      // On success the provider flips `status`, and the redirect above takes over.
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white"
          >
            SB
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Seat Booker</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage workshop registrations.</p>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm"
        >
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="you@centre.dev"
            value={email}
            required
            autoFocus
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors['email']}
          />

          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            required
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors['password']}
          />

          {/* Credential failures are form-level: the API will not say which field was wrong. */}
          {Object.keys(fieldErrors).length === 0 ? <FormError error={error} /> : null}

          <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are created by an administrator. Contact the centre office if you need access.
        </p>
      </div>
    </div>
  );
}
