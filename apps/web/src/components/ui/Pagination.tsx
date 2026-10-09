import type { ReactElement } from 'react';
import { Button } from './Button';

/**
 * Page controls for the `{ items, page, pageSize, total }` envelope every list endpoint
 * returns. Kept deliberately plain — prev/next plus a count — because the lists here are
 * short and a numbered pager would be more chrome than the data warrants.
 */

interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly isLoading?: boolean;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  isLoading = false,
}: PaginationProps): ReactElement | null {
  const lastPage = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  // One page of results needs no controls at all.
  if (total === 0 || lastPage === 1) return null;

  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3"
    >
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{firstShown}</span>–
        <span className="font-medium text-slate-700">{lastShown}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-slate-500">
          Page {page} of {lastPage}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= lastPage || isLoading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
