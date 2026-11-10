export type ReportType = 'lost' | 'found';
export type Custody = 'with_finder' | 'security' | 'returned';
export type ReportStatus = 'active' | 'recovered';
export type MarkerState = 'far' | 'near' | 'inRange';

export type Category =
  | 'id'
  | 'bag'
  | 'umbrella'
  | 'gadget'
  | 'tumbler'
  | 'clothing'
  | 'keys'
  | 'other';

export interface Report {
  id: string;
  type: ReportType;
  name: string;
  category: Category;
  description: string;
  /** Compressed base64 data URL. Optional for lost reports. */
  photo?: string;
  lat: number;
  lng: number;
  /** Search perimeter in metres (lost reports only). */
  radius?: number;
  occurredAt?: string;
  createdAt: string;
  reporterName: string;
  /** How to reach the reporter, e.g. a Messenger name. Shown in range only. */
  contact: string;
  /** Found reports only: who holds the item now. */
  custody?: Custody;
  status: ReportStatus;
}

export interface SurrenderPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hours: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** A report plus everything the map needs to draw it for this user. */
export interface ReportView {
  report: Report;
  /** Metres from the user, or null while the location is unknown. */
  distance: number | null;
  state: MarkerState;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  id: 'ID / Card',
  bag: 'Bag',
  umbrella: 'Umbrella',
  gadget: 'Gadget',
  tumbler: 'Tumbler',
  clothing: 'Clothing',
  keys: 'Keys',
  other: 'Other',
};

/** Ionicons used as the item "silhouette". */
export const CATEGORY_ICON: Record<Category, string> = {
  id: 'id-card',
  bag: 'bag-handle',
  umbrella: 'umbrella',
  gadget: 'phone-portrait',
  tumbler: 'water',
  clothing: 'shirt',
  keys: 'key',
  other: 'help',
};

export const CUSTODY_LABEL: Record<Custody, string> = {
  with_finder: 'With the finder',
  security: 'Surrendered to Campus Security',
  returned: 'Returned to owner',
};
