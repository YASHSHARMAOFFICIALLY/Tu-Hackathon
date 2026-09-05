/**
 * Class-name joiner.
 *
 * `clsx` + `tailwind-merge` is the usual pairing, and neither is installed:
 * conditional classes here are additive (a variant tint, an open state), never
 * two competing values for the same Tailwind property, so there is nothing for
 * a merge step to resolve. Add the dependencies the day a component genuinely
 * needs to override a class passed in from outside.
 */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
