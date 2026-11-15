/**
 * The German traffic signs the site's panels carry (owner 2026-10-05: "It
 * should look familiar for the drivers"). `components/RoadSign.astro` draws
 * each; this is only the closed list of names, so a data file can name a sign
 * without importing a component.
 */
export const SIGN_KINDS = ["autobahn", "parking", "lorry", "charging", "fuel", "stop", "warning", "info", "train"] as const;
export type SignKind = (typeof SIGN_KINDS)[number];
