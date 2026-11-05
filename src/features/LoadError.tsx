type Props = { what: string; errors: string[]; onRetry: () => void };

export function LoadError({ what, errors, onRetry }: Props) {
  return (
    <div role="alert" className="error">
      <p>
        Couldn't load {what}: {errors.join('; ')}
      </p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
