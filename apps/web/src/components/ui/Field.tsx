import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * Labelled form controls with inline error text.
 *
 * Errors are rendered under the field and linked with `aria-describedby`, so a
 * `VALIDATION_ERROR` detail from the API lands on the field it names rather than in a
 * toast. The staff are non-technical — "email must be a valid email address" next to the
 * email box is the difference between a fixable form and a dead end.
 */

interface FieldShellProps {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly required?: boolean;
  readonly htmlFor: string;
  readonly errorId: string;
  readonly hintId: string;
  readonly children: ReactNode;
}

function FieldShell({
  label,
  error,
  hint,
  required = false,
  htmlFor,
  errorId,
  hintId,
  children,
}: FieldShellProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint !== undefined && error === undefined ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:bg-slate-50 disabled:text-slate-500';

function controlClasses(hasError: boolean): string {
  return hasError
    ? `${CONTROL_BASE} border-rose-400 focus-visible:ring-rose-500`
    : `${CONTROL_BASE} border-slate-300 focus-visible:ring-slate-400`;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

export function TextField({ label, error, hint, required, ...rest }: TextFieldProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={id}
      errorId={errorId}
      hintId={hintId}
    >
      <input
        id={id}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
        className={controlClasses(error !== undefined)}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className'
> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
}

export function SelectField({
  label,
  error,
  hint,
  required,
  children,
  ...rest
}: SelectFieldProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={id}
      errorId={errorId}
      hintId={hintId}
    >
      <select
        id={id}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
        className={controlClasses(error !== undefined)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'className'
> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  ...rest
}: TextAreaFieldProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={id}
      errorId={errorId}
      hintId={hintId}
    >
      <textarea
        id={id}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
        className={controlClasses(error !== undefined)}
        {...rest}
      />
    </FieldShell>
  );
}

interface CheckboxFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className' | 'type'
> {
  readonly label: string;
}

export function CheckboxField({ label, ...rest }: CheckboxFieldProps): ReactElement {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
        {...rest}
      />
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
    </div>
  );
}
