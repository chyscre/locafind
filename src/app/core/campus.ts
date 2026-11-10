import { LatLng } from './report.model';

/*
 * NEUST Main Campus, Sumacab Este, Cabanatuan City.
 * Source: OpenStreetMap (way 120108977 and the named buildings inside it),
 * retrieved 2026-11-09. Data © OpenStreetMap contributors, ODbL.
 */

/** Centre of the campus area. */
export const CAMPUS_CENTER: LatLng = { lat: 15.447188, lng: 120.939638 };

/** Corners of the campus bounding box (south-west, north-east). */
export const CAMPUS_BOUNDS: [LatLng, LatLng] = [
  { lat: 15.44396, lng: 120.937176 },
  { lat: 15.450416, lng: 120.9421 },
];

/** Campus outline, used to draw the play area. */
export const CAMPUS_BOUNDARY: [number, number][] = [
  [15.447568, 120.937176], [15.44832, 120.937558], [15.449693, 120.938238], [15.450416, 120.938667],
  [15.450207, 120.939043], [15.450081, 120.939268], [15.449298, 120.94074], [15.448569, 120.9421],
  [15.447892, 120.941656], [15.447343, 120.94133], [15.446134, 120.940629], [15.445966, 120.940469],
  [15.445436, 120.941491], [15.444818, 120.941333], [15.44396, 120.94122], [15.444008, 120.940759],
  [15.444088, 120.939995], [15.444212, 120.939863], [15.444495, 120.939661], [15.444591, 120.939452],
  [15.444493, 120.939264], [15.44435, 120.939178], [15.44424, 120.939014], [15.44425, 120.938803],
  [15.444418, 120.938666], [15.444719, 120.938461], [15.444829, 120.938368], [15.445045, 120.93836],
  [15.44522, 120.938392], [15.445362, 120.938364], [15.445474, 120.938285], [15.44561, 120.938225],
  [15.445712, 120.938039], [15.445888, 120.93791], [15.446349, 120.937873], [15.446581, 120.937845],
  [15.446892, 120.937659], [15.447391, 120.937538], [15.447494, 120.937342], [15.447537, 120.937273],
];

/** Named campus places from OpenStreetMap (a selection). */
export const LANDMARKS = {
  library: { lat: 15.446787, lng: 120.938757, name: 'University Library' },
  admin: { lat: 15.445815, lng: 120.939699, name: 'Administration Building' },
  cafeteria: { lat: 15.445101, lng: 120.939397, name: 'University Cafeteria' },
  cict: { lat: 15.449353, lng: 120.94041, name: 'CICT Building' },
  gym: { lat: 15.448651, lng: 120.941095, name: 'NEUST Gym' },
  engineering: { lat: 15.447476, lng: 120.940489, name: 'College of Engineering' },
  cas: { lat: 15.446859, lng: 120.940848, name: 'CAS Building' },
  grandstand: { lat: 15.449345, lng: 120.939348, name: 'NEUST Grandstand' },
  guardHouse: { lat: 15.444783, lng: 120.94129, name: 'Guard House' },
  westGate: { lat: 15.447549, lng: 120.937236, name: 'West Gate' },
} as const;

/** Building labels for the bird's-eye view (OpenStreetMap names). */
export const MAP_LABELS: { name: string; lat: number; lng: number }[] = [
  { name: 'University Library', lat: 15.446787, lng: 120.938757 },
  { name: 'Administration Bldg', lat: 15.445815, lng: 120.939699 },
  { name: 'University Cafeteria', lat: 15.445101, lng: 120.939397 },
  { name: 'NEUST Hostel', lat: 15.445278, lng: 120.939098 },
  { name: 'CICT Building', lat: 15.449353, lng: 120.94041 },
  { name: 'NEUST Gym', lat: 15.448651, lng: 120.941095 },
  { name: 'College of Engineering', lat: 15.447476, lng: 120.940489 },
  { name: 'CAS Building', lat: 15.446859, lng: 120.940848 },
  { name: 'College of Education', lat: 15.447287, lng: 120.938629 },
  { name: 'College of Criminology', lat: 15.448884, lng: 120.938167 },
  { name: 'College of Architecture', lat: 15.446307, lng: 120.93929 },
  { name: 'NEUST Grandstand', lat: 15.449345, lng: 120.939348 },
  { name: 'Cultural Building', lat: 15.44962, lng: 120.939822 },
  { name: 'Swimming Pool', lat: 15.448295, lng: 120.941634 },
  { name: 'Guard House', lat: 15.444783, lng: 120.94129 },
  { name: 'West Gate', lat: 15.447549, lng: 120.937236 },
];

/** Is a point inside the campus outline? (ray casting) */
export function insideCampus(p: LatLng): boolean {
  let inside = false;
  const pts = CAMPUS_BOUNDARY;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
