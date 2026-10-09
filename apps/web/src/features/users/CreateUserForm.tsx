import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { ROLES } from '@seat-booker/contracts';
import type { Role } from '@seat-booker/contracts';
import { useCreateUser } from './use-users';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { FormError } from '../../components/ui/States';
import { asApiError } from '../../lib/api-error';

/**
 * Create-user form (ADMIN only). There is no public signup — this is the only way an
 * account comes into existence after the seeded first admin.
 *
 * The admin sets an initial password and passes it on to the new user out of band. That is
 * a deliberate simplification over an email invitation flow: there is no mail service in
 * scope, and a password the admin can read is better than an invite link that goes nowhere.
 */

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Admin — manages accounts',
  MANAGER: 'Manager — workshops and registrations',
  STAFF: 'Staff — registrations only',
};

export function CreateUserForm({ onCreated }: { readonly onCreated?: () => void }): ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [password, setPassword] = useState('');
  const [localErrors, setLocalErrors] = useState<Readonly<Record<string, string>>>({});

  const mutation = useCreateUser();
  const apiError = asApiError(mutation.error);
  const apiFieldErrors = apiError?.fieldErrors() ?? {};

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (mutation.isPending) return;

    const errors: Record<string, string> = {};
    if (name.trim().length === 0) errors['name'] = 'Enter the person’s name.';
    if (email.trim().length === 0) errors['email'] = 'Enter an email address.';
    if (password.length < 8) errors['password'] = 'Use at least 8 characters.';

    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate(
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        password,
      },
      {
        onSuccess: () => {
          setName('');
          setEmail('');
          setRole('STAFF');
          setPassword('');
          setLocalErrors({});
          onCreated?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Name"
        value={name}
        required
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
        error={localErrors['name'] ?? apiFieldErrors['name']}
      />

      <TextField
        label="Email"
        type="email"
        value={email}
        required
        maxLength={254}
        placeholder="name@centre.dev"
        onChange={(event) => setEmail(event.target.value)}
        error={localErrors['email'] ?? apiFieldErrors['email']}
        hint="Used to sign in. Must not already be in use."
      />

      <SelectField
        label="Role"
        value={role}
        onChange={(event) => setRole(event.target.value as Role)}
        error={apiFieldErrors['role']}
      >
        {ROLES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </SelectField>

      <TextField
        label="Initial password"
        type="password"
        value={password}
        required
        autoComplete="new-password"
        maxLength={200}
        onChange={(event) => setPassword(event.target.value)}
        error={localErrors['password'] ?? apiFieldErrors['password']}
        hint="Share it with them directly; they can change it later."
      />

      <div className="sm:col-span-2">
        {apiError !== null && apiError.code !== 'VALIDATION_ERROR' ? (
          <FormError error={mutation.error} />
        ) : null}
      </div>

      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" isLoading={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}
