import type { ReactElement, ReactNode } from 'react';

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ children, className = '' }: CardProps): ReactElement {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  readonly title: string;
  readonly description?: string | undefined;
  readonly actions?: ReactNode;
}

export function CardHeader({ title, description, actions }: CardHeaderProps): ReactElement {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description !== undefined ? (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ children, className = '' }: CardProps): ReactElement {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
