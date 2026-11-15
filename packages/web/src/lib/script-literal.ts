/**
 * A string as a JavaScript string literal inside an inline `<script>` (CodeQL js/bad-code-sanitization, viafrei-web PR #15).
 * `JSON.stringify` alone is not that: a string holding `</script>` or `<!--` would end or change the script element
 * around it, and U+2028/U+2029 end a line in a pre-ES2019 engine. Each of those is written as its `\uXXXX` escape —
 * the same value once parsed — and nothing else is touched, so a literal without them (every constant the shell
 * writes today) is byte for byte what `JSON.stringify` gave.
 */
export function scriptLiteral(s: string): string {
  return JSON.stringify(s).replace(/[<>\u2028\u2029]/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
