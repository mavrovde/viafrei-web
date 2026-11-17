// The site shell's server entry imports this module FIRST (#1332). @astrojs/node's own entry starts its
// server when it is imported, unless ASTRO_NODE_AUTOSTART is "disabled". That is the adapter's documented
// way to start the server yourself. `entry.ts` starts it instead, and gives it the idle keep-alive every
// server here shares.
//
// The INCOMING value is kept first. A caller that set "disabled" itself must still get no server.
// @astrojs/node's preview.js does exactly that before it imports the entry.
export const AUTOSTART_DISABLED_BY_CALLER = process.env["ASTRO_NODE_AUTOSTART"] === "disabled";
process.env["ASTRO_NODE_AUTOSTART"] = "disabled";
