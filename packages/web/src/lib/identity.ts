/**
 * The § 5 DDG identity, read at request time from the host's `.env` through
 * the compose `web` service (#379 work item 4). The names are the deploy's
 * `LANDING_IDENTITY` list; the four of `LANDING_REQUIRED` must be present or
 * the legal page is a 500 — never a half Impressum with an empty line where a
 * name belongs. No value lives in any committed file.
 */
export type Identity = {
  readonly name: string;
  /** Empty when `addressPending`: a placeholder is never rendered. */
  readonly street: string;
  /** Empty when `addressPending`. */
  readonly city: string;
  /**
   * True when the street or the city on the host is still a PLACEHOLDER
   * (launch audit F-9): the pages then say `ADDRESS_PENDING_NOTE` in its place
   * and never print the placeholder itself.
   */
  readonly addressPending: boolean;
  readonly email: string;
  readonly phone: string | undefined;
  readonly vatId: string | undefined;
  /** The competent supervisory authority; the deploy's fallback wording when unset. */
  readonly authority: string;
  /** The business contact (#144); falls back to the § 5 e-mail. */
  readonly contactEmail: string;
};

export const REQUIRED_IDENTITY = ["IMPRESSUM_NAME", "IMPRESSUM_STREET", "IMPRESSUM_CITY", "IMPRESSUM_EMAIL"] as const;

/** the deploy `LANDING_AUTHORITY_FALLBACK`, verbatim. */
export const AUTHORITY_FALLBACK = "die Landesdatenschutzbehörde am Sitz des Verantwortlichen";

/** What the legal pages print where a placeholder address would have been (F-9). German, like both pages. */
export const ADDRESS_PENDING_NOTE = "Anschrift wird ergänzt";

/**
 * Does this value look like a placeholder rather than a § 5 DDG fact (launch
 * audit F-9)? Bracketed text (`[Straße]`, `<PLZ Ort>`, `{city}`), the words
 * "folgt", "TODO", "tbd", "Platzhalter"/"placeholder", or a run of three x.
 * The same rule as `IDENTITY_PLACEHOLDER_ERE` in the deploy;
 * `test/identity-placeholder.test.ts` holds the two to one table of cases.
 */
export function looksLikePlaceholder(value: string): boolean {
  return /[[\]<>{}]|(^|[^\p{L}])(folgt|todo|tbd|platzhalter|placeholder)([^\p{L}]|$)|x{3,}/iu.test(value);
}

export class MissingIdentity extends Error {}

export function readIdentity(env: Readonly<Record<string, string | undefined>> = process.env): Identity {
  const raw = (k: string): string | undefined => {
    const v = (env[k] ?? "").trim();
    return v === "" ? undefined : v;
  };
  // A placeholder is never a value (F-9): for an optional key it is absent, for
  // the name and the e-mail it is MISSING (a 500, as before), and for the
  // street or the city it is the pending note below.
  const get = (k: string): string | undefined => {
    const v = raw(k);
    return v === undefined || looksLikePlaceholder(v) ? undefined : v;
  };
  const missing = REQUIRED_IDENTITY.filter((k) => raw(k) === undefined);
  if (missing.length > 0) throw new MissingIdentity(`identity incomplete: ${missing.join(", ")} not set`);
  const placeholder = (["IMPRESSUM_NAME", "IMPRESSUM_EMAIL"] as const).filter((k) => get(k) === undefined);
  if (placeholder.length > 0) throw new MissingIdentity(`identity incomplete: ${placeholder.join(", ")} is a placeholder`);
  const email = get("IMPRESSUM_EMAIL")!;
  const street = get("IMPRESSUM_STREET");
  const city = get("IMPRESSUM_CITY");
  const addressPending = street === undefined || city === undefined;
  return {
    name: get("IMPRESSUM_NAME")!,
    street: addressPending ? "" : street,
    city: addressPending ? "" : city,
    addressPending,
    email,
    phone: get("IMPRESSUM_PHONE"),
    vatId: get("IMPRESSUM_VAT_ID"),
    authority: get("IMPRESSUM_AUTHORITY") ?? AUTHORITY_FALLBACK,
    contactEmail: readContactEmail(env) ?? email,
  };
}

/** The business contact (#144) on its own: `CONTACT_EMAIL`, else the § 5 address, else none — never a 500, the page then points at the Impressum. */
export function readContactEmail(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  for (const k of ["CONTACT_EMAIL", "IMPRESSUM_EMAIL"]) {
    const v = (env[k] ?? "").trim();
    if (v !== "" && !looksLikePlaceholder(v)) return v;
  }
  return null;
}

/** For a page's frontmatter: the identity, or the 500 the page must return instead of rendering half of itself. */
export function identityOrError(env: Readonly<Record<string, string | undefined>> = process.env): Identity | Response {
  try {
    return readIdentity(env);
  } catch (e) {
    if (e instanceof MissingIdentity) {
      return new Response("Service temporarily unavailable.\n", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    throw e;
  }
}
