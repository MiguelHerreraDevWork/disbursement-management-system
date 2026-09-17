// Single place the app turns an API timestamp into display text, so the
// list and the detail view never drift apart. Locale-default on purpose:
// this is an internal tool and operators read dates in their own locale.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
