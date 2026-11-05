import { pageCount } from './format';

type Props = {
  label: string;
  page: number;
  pageSize: number;
  total: number | null | undefined;
  onChange: (page: number) => void;
};

export function Pager({ label, page, pageSize, total, onChange }: Props) {
  const pages = pageCount(total, pageSize);
  return (
    <nav className="pager" aria-label={label}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Next
      </button>
    </nav>
  );
}
