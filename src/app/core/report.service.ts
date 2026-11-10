import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { distanceM, markerState } from './geo';
import { LocationService } from './location.service';
import { Custody, Report, ReportStatus, ReportView } from './report.model';
import { SAMPLE_REPORTS } from './sample-data';

export type StoredReport = Omit<Report, 'id'>;

/** Every response from backend/api/reports.php looks like this. */
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const MY_IDS_KEY = 'locafind.myReportIds';
const LOCAL_KEY = 'locafind.localReports';
const TIMEOUT_MS = 8000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full: the data just won't survive a restart */
  }
}

/**
 * Loads and saves reports through the LocaFind PHP + MySQL API (backend/api/reports.php)
 * with HttpClient: GET to list, POST to create, PUT to change status or custody.
 *
 * Offline fallback: if the server can't be reached (e.g. the laptop running XAMPP is not
 * on the same Wi-Fi), the app shows sample reports and saves new ones on this phone only.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly location = inject(LocationService);
  private readonly endpoint = environment.apiUrl ? `${environment.apiUrl.replace(/\/$/, '')}/reports.php` : '';

  readonly reports = signal<Report[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** True when the app is running on sample data + reports saved on this phone. */
  readonly offline = signal(!this.endpoint);
  readonly hasServer = !!this.endpoint;

  /**
   * Reports submitted from this phone. The prototype has no login, so "mine" is
   * remembered on the device (see Limitations in the concept doc).
   */
  private readonly myIds = signal<string[]>(readJson<string[]>(MY_IDS_KEY, []));

  readonly mine = computed(() => {
    const ids = new Set(this.myIds());
    return this.reports()
      .filter((r) => ids.has(r.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  /** Active reports with distance and marker state for the current user, nearest first. */
  readonly views = computed<ReportView[]>(() => {
    const me = this.location.position();
    return this.reports()
      .filter((r) => r.status === 'active')
      .map((report) => {
        const distance = me ? distanceM(me, report) : null;
        return { report, distance, state: markerState(distance, report.radius) };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  });

  // ---------- GET ----------

  async load(): Promise<void> {
    if (this.loading()) return;
    if (!this.endpoint) {
      this.useOffline();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Report[]>>(this.endpoint).pipe(timeout(TIMEOUT_MS)),
      );
      this.reports.set(res.data);
      this.offline.set(false);
    } catch {
      this.useOffline();
    } finally {
      this.loading.set(false);
    }
  }

  // ---------- POST ----------

  async add(report: StoredReport): Promise<Report> {
    let saved: Report;
    if (this.offline()) {
      saved = { ...report, id: `local-${Date.now()}` };
      writeJson(LOCAL_KEY, [saved, ...this.localReports()]);
    } else {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<Report>>(this.endpoint, report).pipe(timeout(TIMEOUT_MS)),
      );
      saved = res.data;
    }
    this.reports.update((list) => [saved, ...list]);
    this.myIds.update((ids) => [saved.id, ...ids]);
    writeJson(MY_IDS_KEY, this.myIds());
    return saved;
  }

  // ---------- PUT ----------

  async setStatus(id: string, status: ReportStatus): Promise<void> {
    await this.update(id, { status });
  }

  async setCustody(id: string, custody: Custody): Promise<void> {
    await this.update(id, { custody });
  }

  private async update(id: string, changes: Pick<Partial<Report>, 'status' | 'custody'>): Promise<void> {
    const isLocal = id.startsWith('local-') || id.startsWith('sample-') || id.startsWith('test-');
    if (!isLocal) {
      await firstValueFrom(
        this.http.put<ApiResponse<Report>>(`${this.endpoint}?id=${encodeURIComponent(id)}`, changes).pipe(timeout(TIMEOUT_MS)),
      );
    }
    this.reports.update((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    if (id.startsWith('local-')) {
      writeJson(LOCAL_KEY, this.localReports().map((r) => (r.id === id ? { ...r, ...changes } : r)));
    }
  }

  // ---------- DELETE ----------

  /** Remove a report for good (e.g. posted by mistake). Closing it keeps a record instead. */
  async remove(id: string): Promise<void> {
    const isLocal = id.startsWith('local-') || id.startsWith('sample-') || id.startsWith('test-');
    if (!isLocal) {
      await firstValueFrom(
        this.http.delete<ApiResponse<null>>(`${this.endpoint}?id=${encodeURIComponent(id)}`).pipe(timeout(TIMEOUT_MS)),
      );
    }
    this.reports.update((list) => list.filter((r) => r.id !== id));
    if (id.startsWith('local-')) writeJson(LOCAL_KEY, this.localReports().filter((r) => r.id !== id));
    this.myIds.update((ids) => ids.filter((x) => x !== id));
    writeJson(MY_IDS_KEY, this.myIds());
  }

  // ---------- test items (for testing anywhere, e.g. at home) ----------

  readonly hasTestItems = computed(() => this.reports().some((r) => r.id.startsWith('test-')));

  /**
   * Put a few pretend reports around a point (usually where the phone is now), so the
   * real-GPS flow can be tested by walking around without being on campus. They stay on
   * this phone only and are never sent to the database.
   */
  placeTestItems(center: { lat: number; lng: number }): void {
    const at = (north: number, east: number) => ({
      lat: center.lat + north / 110574,
      lng: center.lng + east / (111320 * Math.cos((center.lat * Math.PI) / 180)),
    });
    const now = new Date().toISOString();
    const base = { createdAt: now, reporterName: 'Test Item', contact: 'Test only (not saved)', status: 'active' as const };
    const items: Report[] = [
      { ...base, id: `test-${Date.now()}-1`, type: 'lost', name: 'Test umbrella', category: 'umbrella', description: 'Test item about 60 m north of where you started.', ...at(60, 0), radius: 30 },
      { ...base, id: `test-${Date.now()}-2`, type: 'lost', name: 'Test backpack', category: 'bag', description: 'Test item about 130 m east, with a 50 m perimeter.', ...at(0, 130), radius: 50 },
      { ...base, id: `test-${Date.now()}-3`, type: 'lost', name: 'Test ID', category: 'id', description: 'Test item about 25 m away: you start inside its perimeter.', ...at(-15, -20), radius: 30 },
      { ...base, id: `test-${Date.now()}-4`, type: 'found', name: 'Test keys', category: 'keys', description: 'Test found item about 80 m south-west.', ...at(-55, -60), custody: 'with_finder' },
    ];
    this.clearTestItems();
    this.reports.update((list) => [...list, ...items]);
  }

  clearTestItems(): void {
    this.reports.update((list) => list.filter((r) => !r.id.startsWith('test-')));
  }

  // ---------- offline fallback ----------

  private localReports(): Report[] {
    return readJson<Report[]>(LOCAL_KEY, []);
  }

  private useOffline(): void {
    this.offline.set(true);
    this.reports.set([...this.localReports(), ...SAMPLE_REPORTS]);
  }
}
