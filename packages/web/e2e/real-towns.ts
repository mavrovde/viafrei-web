/**
 * #984: the GN250 Gemeinden the motorway maps' fixture draws (`MAP_TOWNS_SQL`'s rows) — at production's SHAPE: the
 * Großstädte of 100 000 or more (the overview names them) at their approximate places and rounded populations, and a
 * deterministic scatter of small invented Gemeinden along the fixture's A7 (9.2–10.0° E), so a zoomed map of any
 * radius has towns to name. Plausible figures, not production data; no AGS (the map never carries one).
 */
import type { MapTownRow } from "@viafrei/digest";

const BIG: readonly (readonly [string, number, number, number])[] = [
  ["Berlin", 3_760_000, 52.52, 13.405], ["Hamburg", 1_890_000, 53.551, 9.994], ["München", 1_510_000, 48.137, 11.576], ["Köln", 1_080_000, 50.938, 6.96],
  ["Frankfurt am Main", 770_000, 50.11, 8.682], ["Stuttgart", 630_000, 48.776, 9.183], ["Düsseldorf", 620_000, 51.227, 6.774], ["Leipzig", 620_000, 51.34, 12.375],
  ["Dortmund", 590_000, 51.514, 7.466], ["Essen", 580_000, 51.456, 7.012], ["Bremen", 570_000, 53.079, 8.801], ["Dresden", 560_000, 51.05, 13.738],
  ["Hannover", 545_000, 52.376, 9.732], ["Nürnberg", 525_000, 49.452, 11.077], ["Duisburg", 500_000, 51.435, 6.763], ["Bochum", 365_000, 51.482, 7.216],
  ["Wuppertal", 355_000, 51.256, 7.151], ["Bielefeld", 335_000, 52.03, 8.532], ["Bonn", 335_000, 50.737, 7.098], ["Münster", 320_000, 51.96, 7.626],
  ["Mannheim", 315_000, 49.488, 8.466], ["Karlsruhe", 308_000, 49.007, 8.404], ["Augsburg", 300_000, 48.371, 10.898], ["Wiesbaden", 283_000, 50.078, 8.24],
  ["Mönchengladbach", 262_000, 51.185, 6.442], ["Gelsenkirchen", 262_000, 51.517, 7.086], ["Aachen", 250_000, 50.776, 6.084], ["Braunschweig", 250_000, 52.269, 10.521],
  ["Kiel", 247_000, 54.323, 10.123], ["Chemnitz", 245_000, 50.833, 12.917], ["Halle (Saale)", 240_000, 51.483, 11.97], ["Magdeburg", 240_000, 52.12, 11.628],
  ["Freiburg im Breisgau", 233_000, 47.999, 7.842], ["Krefeld", 228_000, 51.339, 6.586], ["Mainz", 220_000, 49.993, 8.247], ["Lübeck", 218_000, 53.866, 10.686],
  ["Erfurt", 214_000, 50.978, 11.029], ["Oberhausen", 210_000, 51.47, 6.852], ["Rostock", 210_000, 54.092, 12.099], ["Kassel", 202_000, 51.312, 9.48],
  ["Hagen", 189_000, 51.367, 7.463], ["Potsdam", 185_000, 52.39, 13.065], ["Saarbrücken", 180_000, 49.234, 6.997], ["Hamm", 180_000, 51.681, 7.815],
  ["Ludwigshafen am Rhein", 172_000, 49.477, 8.445], ["Oldenburg", 170_000, 53.143, 8.214], ["Mülheim an der Ruhr", 170_000, 51.418, 6.884], ["Osnabrück", 165_000, 52.279, 8.047],
  ["Leverkusen", 164_000, 51.046, 7.006], ["Heidelberg", 160_000, 49.398, 8.672], ["Darmstadt", 160_000, 49.873, 8.651], ["Solingen", 159_000, 51.171, 7.083],
  ["Regensburg", 155_000, 49.013, 12.101], ["Herne", 156_000, 51.539, 7.226], ["Paderborn", 152_000, 51.718, 8.757], ["Neuss", 152_000, 51.2, 6.692],
  ["Ingolstadt", 140_000, 48.765, 11.424], ["Offenbach am Main", 132_000, 50.096, 8.776], ["Fürth", 131_000, 49.477, 10.989], ["Würzburg", 128_000, 49.791, 9.953],
  ["Ulm", 128_000, 48.401, 9.987], ["Heilbronn", 127_000, 49.142, 9.218], ["Pforzheim", 126_000, 48.892, 8.694], ["Wolfsburg", 125_000, 52.423, 10.787],
  ["Göttingen", 118_000, 51.541, 9.916], ["Bottrop", 117_000, 51.524, 6.929], ["Reutlingen", 117_000, 48.491, 9.204], ["Erlangen", 116_000, 49.59, 11.004],
  ["Bremerhaven", 115_000, 53.54, 8.58], ["Koblenz", 114_000, 50.356, 7.594], ["Bergisch Gladbach", 112_000, 50.992, 7.136], ["Remscheid", 112_000, 51.179, 7.189],
  ["Trier", 111_000, 49.75, 6.637], ["Recklinghausen", 110_000, 51.614, 7.198], ["Jena", 110_000, 50.927, 11.589], ["Moers", 104_000, 51.451, 6.626],
  ["Salzgitter", 104_000, 52.15, 10.333], ["Siegen", 102_000, 50.875, 8.024], ["Gütersloh", 101_000, 51.907, 8.379], ["Hildesheim", 101_000, 52.152, 9.951],
  ["Cottbus", 100_000, 51.756, 14.333],
];

const SMALL = ["Beispielfeld", "Musterbach", "Probstheide", "Neuenhagen am Wald", "Altdorf", "Kleinmusterau", "Sankt Beispiel", "Oberweiler", "Unterbach", "Bad Probedorf"];

/** Every row the fixture's `MAP_TOWNS_SQL` answers: the Großstädte, then 180 small Gemeinden along the fixture A7. */
export const MAP_TOWNS: readonly MapTownRow[] = [
  ...BIG.map(([name, population, lat, lon]) => ({ name, population, lat, lon })),
  ...Array.from({ length: 180 }, (_, i) => ({
    name: `${SMALL[i % SMALL.length]!} ${String(i + 1)}`,
    population: 1_000 + ((i * 7_919) % 29_000),
    lat: 47.6 + ((i * 37) % 180) * 0.04 + ((i * 13) % 7) * 0.003,
    lon: 9.2 + ((i * 53) % 17) * 0.05,
  })),
];
