/**
 * Date formatting, with the locale pinned.
 *
 * `toLocaleDateString()` with no arguments takes its format from whatever
 * machine ran it: the deployment region for a server component, the visitor's
 * own settings for a client one. The same timestamp could come out `6/9/2026`
 * in one place and `9/6/2026` in another, and neither the reader nor a judge
 * can tell which of the two numbers is the month.
 *
 * `en-GB` with an explicit shape gives one unambiguous answer everywhere:
 * "6 Sep 2026". The month is a word, so there is nothing left to misread.
 *
 * The time zone is deliberately *not* pinned. A citizen reading when their
 * report was acknowledged wants their own clock, and the day is the part that
 * had to stop drifting.
 */
const DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

/** "6 Sep 2026" */
export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-GB", DATE);
}

/** "6 Sep 2026, 14:02" */
export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("en-GB", { ...DATE, ...TIME });
}
