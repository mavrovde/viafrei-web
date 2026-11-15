/** #944: the `Vary` header of an HTML answer. */
/** A `Vary` value with `name` added once (case-insensitive), the existing names kept in their order. */
export function varyWith(vary: string | null, name: string): string {
  const names = (vary ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return names.some((n) => n === "*" || n.toLowerCase() === name.toLowerCase()) ? names.join(", ") : [...names, name].join(", ");
}
