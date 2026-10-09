import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-md text-sm text-slate-600">
        That page does not exist. It may have been removed, or the link may be wrong.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Back to start
      </Link>
    </div>
  );
}
