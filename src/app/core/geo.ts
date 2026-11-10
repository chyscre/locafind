import { LatLng, MarkerState } from './report.model';

/** Items closer than this show up in the Nearby panel and pulse on the map. */
export const NEARBY_RANGE_M = 100;

/** Perimeter used when a lost report has no radius (also the minimum, for GPS error). */
export const DEFAULT_RADIUS_M = 30;

/** Great-circle distance in metres (haversine formula). */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Far     -> outside the Nearby range: faint "?" marker, locked card.
 * Near    -> inside the Nearby range but outside the item's perimeter: pulsing "?".
 * inRange -> inside the item's perimeter: marker becomes a pin, full details unlock.
 */
export function markerState(distance: number | null, radius?: number): MarkerState {
  if (distance === null) return 'far';
  const perimeter = Math.max(radius ?? DEFAULT_RADIUS_M, DEFAULT_RADIUS_M);
  if (distance <= perimeter) return 'inRange';
  return distance <= NEARBY_RANGE_M ? 'near' : 'far';
}

export function formatDistance(distance: number | null): string {
  if (distance === null) return 'Distance unknown';
  if (distance < 1000) return `~${Math.round(distance)} m away`;
  return `~${(distance / 1000).toFixed(1)} km away`;
}
