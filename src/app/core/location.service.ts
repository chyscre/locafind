import { Injectable, computed, signal } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { LatLng } from './report.model';

const DEMO_KEY = 'locafind.demoMode';

function readDemoFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Tracks where the user is.
 *
 * Demo mode places the user on campus and lets them "walk" by tapping the map,
 * so the app can be tested (and graded) away from NEUST.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly gps = signal<LatLng | null>(null);
  // Demo start: just inside the West Gate.
  private readonly demoPos = signal<LatLng>({ lat: 15.44745, lng: 120.93752 });
  private watchId: string | null = null;

  readonly demoMode = signal<boolean>(readDemoFlag());
  readonly heading = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  /** The position the rest of the app should use. */
  readonly position = computed<LatLng | null>(() => (this.demoMode() ? this.demoPos() : this.gps()));

  private starting = false;

  async start(): Promise<void> {
    if (this.watchId || this.starting) return;
    this.starting = true;
    try {
      const perm = await Geolocation.checkPermissions().catch(() => null);
      if (perm && perm.location !== 'granted') {
        // requestPermissions is not implemented on the web; the browser asks on its own.
        await Geolocation.requestPermissions().catch(() => undefined);
      }
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
        (pos, err) => {
          if (err || !pos) {
            this.error.set('Location is unavailable. Turn on location, or use Demo mode.');
            return;
          }
          this.error.set(null);
          this.gps.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          this.heading.set(pos.coords.heading ?? null);
        },
      );
    } catch {
      this.error.set('Location permission was denied. You can still browse, or use Demo mode.');
    } finally {
      this.starting = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.watchId) return;
    await Geolocation.clearWatch({ id: this.watchId });
    this.watchId = null;
  }

  setDemoMode(on: boolean): void {
    this.demoMode.set(on);
    try {
      localStorage.setItem(DEMO_KEY, on ? '1' : '0');
    } catch {
      /* storage blocked: the setting just won't be remembered */
    }
  }

  /**
   * Demo mode only: walk the user to a tapped point. The position moves in small steps
   * (like real GPS updates), so distances, unlocks and alerts happen as the avatar arrives.
   */
  setDemoPosition(target: LatLng): void {
    this.demoTarget = target;
    if (this.demoTimer) return;
    this.demoTimer = setInterval(() => {
      const from = this.demoPos();
      const to = this.demoTarget;
      if (!to) return this.stopDemoWalk();
      const dLat = (to.lat - from.lat) * 110574;
      const dLng = (to.lng - from.lng) * 111320 * Math.cos((from.lat * Math.PI) / 180);
      const dist = Math.hypot(dLat, dLng);
      const step = (DEMO_SPEED * DEMO_TICK_MS) / 1000;
      if (dist <= step) {
        this.demoPos.set(to);
        return this.stopDemoWalk();
      }
      const k = step / dist;
      this.demoPos.set({ lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k });
    }, DEMO_TICK_MS);
  }

  private demoTarget: LatLng | null = null;
  private demoTimer?: ReturnType<typeof setInterval>;

  private stopDemoWalk(): void {
    clearInterval(this.demoTimer);
    this.demoTimer = undefined;
    this.demoTarget = null;
  }
}

/** Demo walking speed (m/s): quicker than real walking so demos don't drag. */
export const DEMO_SPEED = 9;
const DEMO_TICK_MS = 120;
