/**
 * THE FIGURES the site's copy may state about ViaFrei itself (#1020): how many
 * tools, prompts, resources, credit lines, languages, motorway pages and
 * assistants. Each is COUNTED here from the list it describes — the catalogue
 * the server listed at build time (`generated/catalogue.json`), the page map's
 * live languages (`pages.ts`), the motorway register (`motorways.ts`) and the
 * connect page's assistant list (`connect-clients.ts`) — and never typed, so a
 * lane that adds a tool, a source, a language or an assistant moves every
 * sentence that states the figure with no second edit. `test/seo-sweep.test.ts`
 * reads the same lists independently and refuses a copy whose figure differs,
 * and refuses a typed figure in the copy deck.
 */
import catalogue from "../generated/catalogue.json" with { type: "json" };
import { NOTE_CLIENTS } from "./connect-clients.js";
import { MOTORWAY_REGISTER } from "./motorways.js";
import { LIVE_LANGS } from "./pages.js";

export type SiteFacts = {
  readonly tools: number;
  readonly prompts: number;
  readonly resources: number;
  /** The credit lines the server attributes (one per source the register holds live). */
  readonly credits: number;
  readonly languages: number;
  readonly motorways: number;
  /** The assistants the connect note names, each with its own block of steps. */
  readonly assistants: number;
  /** The release the catalogue was listed from. */
  readonly release: string;
};

export function siteFacts(): SiteFacts {
  return {
    tools: catalogue.tools.length,
    prompts: catalogue.prompts.length,
    resources: catalogue.resources.length,
    credits: catalogue.credits.length,
    languages: LIVE_LANGS.length,
    motorways: MOTORWAY_REGISTER.length,
    assistants: NOTE_CLIENTS.length,
    release: catalogue.release.version,
  };
}
