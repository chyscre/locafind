import { CAMPUS_CENTER, LANDMARKS } from './campus';
import { Report, SurrenderPoint } from './report.model';

export { CAMPUS_CENTER };

/**
 * Surrender points ("towers"). The Guard House is campus security per OpenStreetMap;
 * TODO: confirm with the guards which posts accept found items, and their hours.
 */
export const SURRENDER_POINTS: SurrenderPoint[] = [
  { id: 'sp-guard-house', name: 'Guard House', lat: LANDMARKS.guardHouse.lat, lng: LANDMARKS.guardHouse.lng, hours: 'Open daily' },
  { id: 'sp-west-gate', name: 'West Gate Guard Post', lat: LANDMARKS.westGate.lat, lng: LANDMARKS.westGate.lng, hours: 'School days' },
  { id: 'sp-admin', name: 'Administration Building', lat: LANDMARKS.admin.lat, lng: LANDMARKS.admin.lng, hours: 'Mon–Fri, 8:00 AM–5:00 PM' },
];

/** Shown when the server can't be reached (offline mode). Placed at real campus buildings. */
export const SAMPLE_REPORTS: Report[] = [
  {
    id: 'sample-1',
    type: 'lost',
    name: 'Blue umbrella',
    category: 'umbrella',
    description: 'Navy blue foldable umbrella with a white handle. Last had it near the Library.',
    lat: LANDMARKS.library.lat,
    lng: LANDMARKS.library.lng,
    radius: 40,
    createdAt: '2026-11-09T08:15:00+08:00',
    reporterName: 'Sample Student A',
    contact: 'Messenger: Sample Student A',
    status: 'active',
  },
  {
    id: 'sample-2',
    type: 'lost',
    name: 'Black backpack',
    category: 'bag',
    description: 'Black backpack with a keychain on the zipper. Left near the CICT Building.',
    lat: LANDMARKS.cict.lat,
    lng: LANDMARKS.cict.lng,
    radius: 60,
    createdAt: '2026-11-08T14:40:00+08:00',
    reporterName: 'Sample Student B',
    contact: 'Messenger: Sample Student B',
    status: 'active',
  },
  {
    id: 'sample-3',
    type: 'lost',
    name: 'School ID',
    category: 'id',
    description: 'NEUST ID with a green lanyard. Probably at the Cafeteria.',
    lat: LANDMARKS.cafeteria.lat,
    lng: LANDMARKS.cafeteria.lng,
    createdAt: '2026-11-07T10:05:00+08:00',
    reporterName: 'Sample Student C',
    contact: 'Messenger: Sample Student C',
    status: 'active',
  },
  {
    id: 'sample-4',
    type: 'found',
    name: 'White tumbler',
    category: 'tumbler',
    description: 'White steel tumbler with stickers, found on a bench by the CAS Building.',
    lat: LANDMARKS.cas.lat,
    lng: LANDMARKS.cas.lng,
    createdAt: '2026-11-09T09:30:00+08:00',
    reporterName: 'Sample Student D',
    contact: 'Messenger: Sample Student D',
    custody: 'security',
    status: 'active',
  },
  {
    id: 'sample-5',
    type: 'found',
    name: 'Car keys',
    category: 'keys',
    description: 'Set of keys with a small red tag, found at the NEUST Gym.',
    lat: LANDMARKS.gym.lat,
    lng: LANDMARKS.gym.lng,
    createdAt: '2026-11-08T16:20:00+08:00',
    reporterName: 'Sample Student E',
    contact: 'Messenger: Sample Student E',
    custody: 'with_finder',
    status: 'active',
  },
];
