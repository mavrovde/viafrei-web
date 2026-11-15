/**
 * #1044: the register line a station page's JSON-LD carries — DB StaDa's credit (`db_stada`), verbatim from the
 * register (`generated/catalogue.json`), because the graph names the station's address and point, which are StaDa
 * data (CC BY 4.0): the credit travels inside the graph as the TrainStation's `isBasedOn` (the #1025 shape of the LCL
 * credit). Kept in its own module, reading `db_stada` alone, so `structured-data.ts` reads no register data of its own
 * (`test/live-examples.test.ts`). A register line that no longer has the shape stops the build here.
 */
import catalogue from "../generated/catalogue.json" with { type: "json" };

type Credit = { readonly id: string; readonly text: string; readonly url: string | null; readonly licence: { readonly name: string; readonly url: string } | null };

export type DatasetCredit = { readonly text: string; readonly licence: string; readonly url: string; readonly creator: { readonly name: string; readonly url: string } };

/** One register line as a Dataset credit; a line that no longer has the shape stops the build. */
function creditOf(id: "db_stada" | "delfi_zhv"): DatasetCredit {
  const c = (catalogue as { readonly credits: readonly Credit[] }).credits.find((x) => x.id === id);
  if (c === undefined || c.licence === null) throw new Error(`stada-credit.ts: the register carries no ${id} credit with a licence`);
  if (c.url === null || !c.url.startsWith("https://")) throw new Error(`stada-credit.ts: the register's ${id} credit carries no https source url`);
  const at = c.text.indexOf(`, ${c.licence.name}`);
  const colon = c.text.indexOf(": ");
  // "Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet" → the publisher, its first part
  const between = colon < 0 || at <= colon ? "" : c.text.slice(colon + 2, at).trim();
  const name = between.split(",")[0]?.trim() ?? "";
  if (name === "") throw new Error(`stada-credit.ts: the register's ${id} line names no publisher between the dataset and the licence`);
  return { text: c.text, licence: c.licence.url, url: c.url, creator: { name, url: new URL(c.url).origin } };
}

export const STADA_CREDIT: DatasetCredit = creditOf("db_stada");
/** #1087: a railway station StaDa does not list is named and placed by the zHV (`delfi_zhv`), credited the same way. */
export const ZHV_CREDIT: DatasetCredit = creditOf("delfi_zhv");
