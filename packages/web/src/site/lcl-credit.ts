/**
 * The ONE register line the JSON-LD may carry (#1025): the BASt Location Code List's credit, verbatim from the register
 * (`generated/catalogue.json`, id `bast_lcl`), for an exit page's graph, which names an LCL junction and its point and
 * so must carry the LCL's credit itself (steward M27). Kept in its own module so `structured-data.ts` reads no register
 * data of its own (fuel condition 6, `test/live-examples.test.ts`) — and this module reads `bast_lcl` and nothing else,
 * which that test asserts too.
 *
 * Since the 2.4.1 review (S3) it also carries the dataset's source `url` and its CREATOR, both from the same register
 * entry and nowhere else: the url is the register's `url`, and the creator is the publisher the credit line names
 * between the dataset and the licence ("…: Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 …") with the origin of
 * that url. A register line that no longer has that shape stops the build here rather than naming nobody.
 */
import catalogue from "../generated/catalogue.json" with { type: "json" };

type Credit = { readonly id: string; readonly text: string; readonly url: string | null; readonly licence: { readonly name: string; readonly url: string } | null };

export const LCL_CREDIT: { readonly text: string; readonly licence: string; readonly url: string; readonly creator: { readonly name: string; readonly url: string } } = (() => {
  const c = (catalogue as { readonly credits: readonly Credit[] }).credits.find((x) => x.id === "bast_lcl");
  if (c === undefined || c.licence === null) throw new Error("lcl-credit.ts: the register carries no bast_lcl credit with a licence");
  if (c.url === null || !c.url.startsWith("https://")) throw new Error("lcl-credit.ts: the register's bast_lcl credit carries no https source url");
  const at = c.text.indexOf(`, ${c.licence.name}`);
  const colon = c.text.indexOf(": ");
  const name = colon < 0 || at <= colon ? "" : c.text.slice(colon + 2, at).trim();
  if (name === "") throw new Error("lcl-credit.ts: the register's bast_lcl line names no publisher between the dataset and the licence");
  return { text: c.text, licence: c.licence.url, url: c.url, creator: { name, url: new URL(c.url).origin } };
})();
