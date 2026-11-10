import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AlertController, NavController } from '@ionic/angular/lazy';
import * as L from 'leaflet';
import { AVATARS, AvatarPreset, avatarBackSvg, avatarById, avatarHeadSvg, avatarSvg } from '../core/avatar';
import { CAMPUS_BOUNDARY, CAMPUS_BOUNDS, CAMPUS_CENTER, MAP_LABELS } from '../core/campus';
import { DEFAULT_RADIUS_M, NEARBY_RANGE_M, distanceM, formatDistance } from '../core/geo';
import { DEMO_SPEED, LocationService } from '../core/location.service';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { CATEGORY_ICON, CATEGORY_LABEL, CUSTODY_LABEL, LatLng, ReportView, SurrenderPoint } from '../core/report.model';
import { ReportService } from '../core/report.service';
import { SURRENDER_POINTS } from '../core/sample-data';

/** Camera settings for the tilted "game" view. */
const TILT_DEG = 56;
const START_ZOOM = 18;



interface Sprite {
  el: HTMLElement;
  lat: number;
  lng: number;
  key: string;
}

interface Tween {
  from: LatLng;
  to: LatLng;
  start: number;
  duration: number;
}

/** Camera tilt/turn animation (for switching to and from the bird's-eye view). */
interface CameraAnim {
  fromTilt: number;
  toTilt: number;
  fromBearing: number;
  toBearing: number;
  start: number;
  duration: number;
  done?: () => void;
}

type Facing = 'front' | 'back' | 'left' | 'right';

/**
 * The discovery map, drawn like a location-based game:
 * - Leaflet draws the ground (tiles, campus outline, perimeters) on a plane tilted in 3D.
 * - Items, towers and the avatar are upright "sprites" in a flat layer on top, placed by
 *   projecting their map position through the same 3D transform, and scaled by distance.
 * - The camera follows the avatar; swipe left/right to turn it, pinch to zoom.
 */
@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
  // Leaflet and the sprite layer build elements outside Angular, so styles must be global.
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class MapPage implements AfterViewInit, OnDestroy {
  @ViewChild('stage', { static: true }) private stageRef!: ElementRef<HTMLDivElement>;
  @ViewChild('mapEl', { static: true }) private mapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('spriteLayer', { static: true }) private spriteRef!: ElementRef<HTMLDivElement>;
  @ViewChild('skyEl', { static: true }) private skyRef!: ElementRef<HTMLDivElement>;

  readonly location = inject(LocationService);
  readonly reports = inject(ReportService);
  readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertController);
  private readonly nav = inject(NavController);
  private readonly sanitizer = inject(DomSanitizer);

  // ----- Leaflet ground -----
  private map?: L.Map;
  private readonly groundLayer = L.layerGroup();
  private readonly perimeters = new Map<string, { key: string; circle: L.Circle }>();
  private rangeCircle?: L.Circle;
  private pulseA?: L.Circle;
  private pulseB?: L.Circle;

  // ----- camera / projection -----
  private bearing = 0;
  private tilt = TILT_DEG;
  private camAnim?: CameraAnim;
  private savedBearing = 0;
  private readonly labelLayer = L.layerGroup();
  private size = 0; // map element is a size x size square
  private left = 0;
  private top = 0;
  private matrix = new DOMMatrix();
  private camPos: LatLng = CAMPUS_CENTER;
  private tween?: Tween;
  private raf = 0;
  private resizeObs?: ResizeObserver;

  // ----- sprites -----
  private readonly sprites = new Map<string, Sprite>();
  private avatarEl?: HTMLElement;
  /** Last walking direction on the map (small lat/lng step), to face the avatar that way. */
  private moveDir: { lat: number; lng: number } | null = null;
  private lastTarget: LatLng | null = null;
  private facing: Facing = 'front';

  // ----- pointer (swipe to turn, tap to walk) -----
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart?: { x: number; y: number; bearing: number; moved: boolean };

  private bannerTimer?: ReturnType<typeof setTimeout>;
  private knownInRange = new Set<string>();
  private readonly ready = signal(false);

  readonly icon = CATEGORY_ICON;
  readonly categoryLabel = CATEGORY_LABEL;
  readonly custodyLabel = CUSTODY_LABEL;
  readonly formatDistance = formatDistance;
  readonly defaultRadius = DEFAULT_RADIUS_M;

  readonly selectedId = signal<string | null>(null);
  readonly selectedTower = signal<SurrenderPoint | null>(null);
  readonly nearbyOpen = signal(false);
  readonly compassMenu = signal(false);
  /** Bird's-eye view: flat, whole campus, labelled, free to pan. */
  readonly overview = signal(false);
  readonly pickerOpen = signal(false);
  readonly pickerAvatar = signal('kitty');
  readonly pickerName = signal('');
  readonly avatars = AVATARS;
  readonly banner = signal<string | null>(null);
  readonly compass = signal(0);

  /** Re-computed as the user moves, so an open card unlocks when they step inside the perimeter. */
  readonly selected = computed<ReportView | null>(
    () => this.reports.views().find((v) => v.report.id === this.selectedId()) ?? null,
  );

  /** "Missing items near you": lost items inside the Nearby range. */
  readonly nearby = computed(() =>
    this.reports.views().filter((v) => v.report.type === 'lost' && v.state !== 'far'),
  );

  readonly towers = computed(() => {
    const me = this.location.position();
    return SURRENDER_POINTS.map((p) => ({ point: p, distance: me ? distanceM(me, p) : null })).sort(
      (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
    );
  });

  readonly profileHead = computed<SafeHtml>(() => this.trust(avatarHeadSvg(this.profile.avatar())));

  constructor() {
    // Items and perimeters follow the data.
    effect(() => {
      const views = this.reports.views();
      if (!this.ready()) return;
      this.syncReports(views);
    });

    // Walk the camera to each new position.
    effect(() => {
      const target = this.location.position();
      const demo = this.location.demoMode();
      if (!this.ready() || !target) return;
      this.walkTo(target, demo);
    });

    // Avatar look.
    effect(() => {
      const avatar = this.profile.avatar();
      if (!this.ready()) return;
      this.buildAvatar(avatar);
    });

    // Radar alert when something is near.
    effect(() => {
      const anyNear = this.nearby().length > 0;
      if (!this.ready()) return;
      this.rangeCircle?.getElement()?.classList.toggle('lf-range--alert', anyNear);
      this.avatarEl?.classList.toggle('lf-avatar--alert', anyNear);
    });

    // Buzz + banner the moment a missing item's perimeter is entered.
    effect(() => {
      const inRange = this.reports
        .views()
        .filter((v) => v.report.type === 'lost' && v.state === 'inRange')
        .map((v) => v.report.id);
      const fresh = inRange.filter((id) => !this.knownInRange.has(id));
      this.knownInRange = new Set(inRange);
      if (fresh.length) this.announceInRange();
    });
  }

  // Ionic doesn't always fire ionViewDidEnter when the app is opened directly on this tab,
  // so both hooks call enter(); it is safe to run more than once.
  ngAfterViewInit(): void {
    setTimeout(() => this.enter());
  }

  ionViewDidEnter(): void {
    this.enter();
  }

  private enter(): void {
    if (!this.map) this.initMap();
    this.layout();
    void this.location.start();
    if (!this.reports.reports().length) void this.reports.load();
    if (!this.raf) this.loop();
  }

  ionViewWillLeave(): void {
    void this.location.stop();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.bannerTimer);
    this.resizeObs?.disconnect();
    this.map?.remove();
  }

  // ================= setup =================

  private initMap(): void {
    const start = this.location.position() ?? CAMPUS_CENTER;
    this.camPos = start;

    const map = L.map(this.mapRef.nativeElement, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: 'center',
      scrollWheelZoom: 'center',
      minZoom: 15,
      maxZoom: 19,
      zoomSnap: 0.25,
      fadeAnimation: false,
      zoomAnimation: false,
    }).setView([start.lat, start.lng], START_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      keepBuffer: 4,
    }).addTo(map);

    // Dim everything outside the campus so the play area stands out.
    const world: L.LatLngExpression[] = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
    L.polygon([world, CAMPUS_BOUNDARY], { interactive: false, className: 'lf-outside' }).addTo(map);
    L.polygon(CAMPUS_BOUNDARY, { interactive: false, className: 'lf-campus' }).addTo(map);

    this.groundLayer.addTo(map);

    // Building labels, shown only in the bird's-eye view (flat, so they read correctly).
    for (const l of MAP_LABELS) {
      L.marker([l.lat, l.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'lf-label-icon', html: `<span>${l.name}</span>`, iconSize: [0, 0] }),
      }).addTo(this.labelLayer);
    }

    // Player rings on the ground.
    this.rangeCircle = L.circle([start.lat, start.lng], { radius: NEARBY_RANGE_M, interactive: false, className: 'lf-range' }).addTo(map);
    this.pulseA = L.circle([start.lat, start.lng], { radius: 22, interactive: false, className: 'lf-pulse' }).addTo(map);
    this.pulseB = L.circle([start.lat, start.lng], { radius: 22, interactive: false, className: 'lf-pulse lf-pulse--b' }).addTo(map);

    map.on('zoom move', () => this.placeSprites());

    this.map = map;

    // Towers never change; create their sprites once.
    for (const p of SURRENDER_POINTS) {
      const el = this.makeSprite(
        `<div class="lf-body lf-body--tower">
           <div class="lf-tower-beam"></div>
           <div class="lf-tower-pole"></div>
           <div class="lf-tower-top"><ion-icon name="shield-checkmark"></ion-icon></div>
           <div class="lf-tower-base"></div>
         </div>`,
        () => {
          this.selectedId.set(null);
          this.selectedTower.set(p);
        },
      );
      this.sprites.set(`tower-${p.id}`, { el, lat: p.lat, lng: p.lng, key: 'tower' });
    }

    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(this.stageRef.nativeElement);

    this.ready.set(true);
  }

  /** Size and place the tilted ground so the avatar stands about two-thirds down the screen. */
  private layout(): void {
    const stage = this.stageRef.nativeElement;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return;
    this.size = Math.ceil(Math.max(W, H) * 2.6);
    // Explorer view: avatar two-thirds down. Bird's-eye view: map centred on screen.
    const anchorY = this.overview() ? H * 0.5 : H * 0.68;
    this.left = W / 2 - this.size / 2;
    this.top = anchorY - this.size / 2;

    const el = this.mapRef.nativeElement;
    el.style.width = `${this.size}px`;
    el.style.height = `${this.size}px`;
    el.style.left = `${this.left}px`;
    el.style.top = `${this.top}px`;
    el.style.setProperty('--lf-perspective', `${Math.round(H * 0.95)}px`);
    const keep = this.overview() && this.map ? this.map.getCenter() : null;
    this.applyCamera();
    this.map?.invalidateSize({ animate: false, pan: false });
    if (keep) this.map?.setView(keep, this.map.getZoom(), { animate: false });
    else this.map?.setView([this.camPos.lat, this.camPos.lng], this.map.getZoom(), { animate: false });
  }

  private applyCamera(): void {
    const el = this.mapRef.nativeElement;
    const H = this.stageRef.nativeElement.clientHeight || 800;
    el.style.transform = `perspective(${Math.round(H * 0.95)}px) rotateX(${this.tilt}deg) rotateZ(${this.bearing}deg)`;
    this.matrix = new DOMMatrix(getComputedStyle(el).transform);
    this.compass.set(this.bearing);

    // The sky's misty bottom covers the far edge of the ground (the horizon), even when turned.
    const corners = [
      this.projectLocal(0, 0),
      this.projectLocal(this.size, 0),
      this.projectLocal(0, this.size),
      this.projectLocal(this.size, this.size),
    ].filter((p): p is { x: number; y: number; scale: number } => !!p);
    const horizon = Math.min(...corners.map((p) => p.y));
    const W = this.stageRef.nativeElement.clientWidth;
    // Where the ground's side edges cross the screen sides, hide them in the mist too.
    const edgeY = this.groundEdgeAtScreenSides(W);
    const mist = Math.max(horizon, edgeY) + 90;
    this.skyRef.nativeElement.style.height = `${Math.max(120, mist)}px`;
    this.updateFacing();
    this.placeSprites();
  }

  // ================= projection =================

  /** Map-element pixel -> screen pixel (and how much to scale things standing there). */
  private projectLocal(x: number, y: number): { x: number; y: number; scale: number } | null {
    const o = this.size / 2;
    const p = this.matrix.transformPoint(new DOMPoint(x - o, y - o, 0, 1));
    if (p.w <= 0.05) return null;
    return { x: this.left + o + p.x / p.w, y: this.top + o + p.y / p.w, scale: 1 / p.w };
  }

  /** Lowest screen y at which the left or right screen edge still shows ground (not the void). */
  private groundEdgeAtScreenSides(W: number): number {
    let y = 0;
    const H = this.stageRef.nativeElement.clientHeight;
    for (const sx of [2, W - 2]) {
      // Walk up the screen edge until the point falls off the ground square.
      for (let sy = H; sy > 0; sy -= 8) {
        const p = this.unprojectScreen(sx, sy);
        if (!p || p.x < 0 || p.y < 0 || p.x > this.size || p.y > this.size) {
          y = Math.max(y, sy);
          break;
        }
      }
    }
    return y;
  }

  /** Screen pixel -> map-element pixel (inverse of the tilt, on the ground plane). */
  private unprojectScreen(sx: number, sy: number): L.Point | null {
    const o = this.size / 2;
    const m = this.matrix;
    const X = sx - this.left - o;
    const Y = sy - this.top - o;
    const a1 = m.m11 - X * m.m14, b1 = m.m21 - X * m.m24, c1 = X * m.m44 - m.m41;
    const a2 = m.m12 - Y * m.m14, b2 = m.m22 - Y * m.m24, c2 = Y * m.m44 - m.m42;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) return null;
    return L.point((c1 * b2 - c2 * b1) / det + o, (a1 * c2 - a2 * c1) / det + o);
  }

  // ================= sprites =================

  private makeSprite(html: string, onTap?: () => void): HTMLElement {
    const el = document.createElement('div');
    el.className = 'lf-sprite';
    el.innerHTML = html;
    if (onTap) {
      const body = el.firstElementChild as HTMLElement;
      body.addEventListener('click', (e) => {
        e.stopPropagation();
        onTap();
      });
    }
    this.spriteRef.nativeElement.appendChild(el);
    return el;
  }

  private removeSprite(id: string): void {
    this.sprites.get(id)?.el.remove();
    this.sprites.delete(id);
  }

  private buildAvatar(a: AvatarPreset): void {
    this.avatarEl?.remove();
    this.avatarEl = this.makeSprite(
      `<div class="lf-body lf-body--avatar"><div class="lf-avatar-shadow"></div>
         <div class="lf-avatar-fig"><div class="lf-avatar-turn">
           <div class="lf-view-front">${avatarSvg(a)}</div>
           <div class="lf-view-back">${avatarBackSvg(a)}</div>
         </div></div>
       </div>`,
      () => this.openPicker(),
    );
    this.avatarEl.classList.add('lf-sprite--avatar', `lf-face-${this.facing}`);
    this.avatarEl.classList.toggle('lf-avatar--alert', this.nearby().length > 0);
    this.placeSprites();
  }

  /** Add, restyle or remove item sprites and perimeters to match the data. */
  private syncReports(views: ReportView[]): void {
    const seen = new Set<string>();
    for (const v of views) {
      const r = v.report;
      const id = `r-${r.id}`;
      seen.add(id);
      const key = `${r.type}-${r.category}-${v.state}-${r.lat}-${r.lng}`;
      const existing = this.sprites.get(id);
      if (!existing || existing.key !== key) {
        if (existing) this.removeSprite(id);
        const el = this.makeSprite(this.itemHtml(v), () => {
          this.selectedTower.set(null);
          this.select(r.id);
        });
        this.sprites.set(id, { el, lat: r.lat, lng: r.lng, key });
      }

      if (r.type === 'lost') {
        const radius = Math.max(r.radius ?? DEFAULT_RADIUS_M, DEFAULT_RADIUS_M);
        const pKey = `${v.state}-${r.lat}-${r.lng}-${radius}`;
        const p = this.perimeters.get(r.id);
        if (!p || p.key !== pKey) {
          if (p) this.groundLayer.removeLayer(p.circle);
          const circle = L.circle([r.lat, r.lng], {
            radius,
            interactive: false,
            className: `lf-perimeter lf-perimeter--${v.state}`,
          }).addTo(this.groundLayer);
          this.perimeters.set(r.id, { key: pKey, circle });
        }
      }
    }
    for (const id of [...this.sprites.keys()]) {
      if (id.startsWith('r-') && !seen.has(id)) this.removeSprite(id);
    }
    for (const [rid, p] of [...this.perimeters]) {
      if (!seen.has(`r-${rid}`)) {
        this.groundLayer.removeLayer(p.circle);
        this.perimeters.delete(rid);
      }
    }
    this.placeSprites();
  }

  private itemHtml(v: ReportView): string {
    const icon = CATEGORY_ICON[v.report.category];
    if (v.report.type === 'found') {
      return `<div class="lf-body lf-body--crate"><div class="lf-crate"><div class="lf-crate-lid"></div><ion-icon name="${icon}"></ion-icon></div><div class="lf-shadow"></div></div>`;
    }
    if (v.state === 'inRange') {
      return `<div class="lf-body lf-body--pin"><div class="lf-pin"><ion-icon name="${icon}"></ion-icon></div><div class="lf-shadow lf-shadow--pin"></div></div>`;
    }
    return `<div class="lf-body lf-body--orb"><div class="lf-orb lf-orb--${v.state}"><span>?</span></div><div class="lf-shadow"></div></div>`;
  }

  /** Put every sprite at its projected screen position, smaller when farther away. */
  private placeSprites(): void {
    if (!this.map || !this.size) return;
    const stage = this.stageRef.nativeElement;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const place = (el: HTMLElement, lat: number, lng: number) => {
      const pt = this.map!.latLngToContainerPoint([lat, lng]);
      const inGround = pt.x >= 0 && pt.y >= 0 && pt.x <= this.size && pt.y <= this.size;
      const s = inGround ? this.projectLocal(pt.x, pt.y) : null;
      if (!s || s.scale < 0.18 || s.x < -80 || s.x > W + 80 || s.y < 0 || s.y > H + 120) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) scale(${s.scale.toFixed(3)})`;
      el.style.zIndex = String(Math.round(s.y));
    };
    for (const sp of this.sprites.values()) place(sp.el, sp.lat, sp.lng);
    if (this.avatarEl) {
      place(this.avatarEl, this.camPos.lat, this.camPos.lng);
      this.avatarEl.style.zIndex = String(Math.round(H * 2)); // the player is always in front
    }
  }

  // ================= movement =================

  private walkTo(target: LatLng, demo: boolean): void {
    const from = this.camPos;
    const d = distanceM(from, target);
    if (d < 0.3) return;
    // Jumps over 2 km (e.g. first GPS fix far from campus) happen instantly.
    // Demo steps arrive every ~120 ms; real GPS fixes every ~1 s. Glide between them.
    const duration = d > 2000 ? 0 : demo ? Math.min(8000, (d / DEMO_SPEED) * 1000) : 1000;

    // Remember the walking direction (as a ~5 m step) so the avatar faces it. Measured
    // between position updates, not from the camera, which may still be catching up.
    const prev = this.lastTarget ?? from;
    const step = distanceM(prev, target);
    if (step > 0.3 && step < 2000) {
      const k = 5 / step;
      this.moveDir = { lat: (target.lat - prev.lat) * k, lng: (target.lng - prev.lng) * k };
      this.updateFacing();
    }
    this.lastTarget = target;

    this.tween = { from, to: target, start: performance.now(), duration };
  }

  /**
   * Turn the avatar toward where it is walking, as seen on screen (so it stays right when
   * the camera turns): away from the camera = back view, toward it = front, else a side.
   */
  private updateFacing(): void {
    if (!this.map || !this.moveDir || !this.avatarEl) return;
    const a = this.map.latLngToContainerPoint([this.camPos.lat, this.camPos.lng]);
    const b = this.map.latLngToContainerPoint([this.camPos.lat + this.moveDir.lat, this.camPos.lng + this.moveDir.lng]);
    const pa = this.projectLocal(a.x, a.y);
    const pb = this.projectLocal(b.x, b.y);
    if (!pa || !pb) return;
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    if (Math.hypot(dx, dy) < 0.5) return;
    const facing: Facing =
      dy < -Math.abs(dx) * 0.6 ? 'back' : dy > Math.abs(dx) * 0.6 ? 'front' : dx < 0 ? 'left' : 'right';
    if (facing === this.facing) return;
    this.avatarEl.classList.remove(`lf-face-${this.facing}`);
    this.avatarEl.classList.add(`lf-face-${facing}`);
    this.facing = facing;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    this.stepCamera();
    const t = this.tween;
    if (!t || !this.map) return;
    const k = t.duration ? Math.min(1, (performance.now() - t.start) / t.duration) : 1;
    this.camPos = {
      lat: t.from.lat + (t.to.lat - t.from.lat) * k,
      lng: t.from.lng + (t.to.lng - t.from.lng) * k,
    };
    // In the bird's-eye view the camera stays put; only the avatar moves.
    if (!this.overview()) {
      this.map.setView([this.camPos.lat, this.camPos.lng], this.map.getZoom(), { animate: false });
    }
    const ll: L.LatLngExpression = [this.camPos.lat, this.camPos.lng];
    this.rangeCircle?.setLatLng(ll);
    this.pulseA?.setLatLng(ll);
    this.pulseB?.setLatLng(ll);
    this.avatarEl?.classList.toggle('lf-walking', k < 1);
    this.placeSprites();
    if (k >= 1) this.tween = undefined;
  };

  /** Advance a tilt/turn animation, if one is running. */
  private stepCamera(): void {
    const c = this.camAnim;
    if (!c) return;
    const t = Math.min(1, (performance.now() - c.start) / c.duration);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
    this.tilt = c.fromTilt + (c.toTilt - c.fromTilt) * e;
    this.bearing = c.fromBearing + (c.toBearing - c.fromBearing) * e;
    this.applyCamera();
    if (t >= 1) {
      this.camAnim = undefined;
      c.done?.();
    }
  }

  private animateCamera(toTilt: number, toBearing: number, done?: () => void): void {
    // Turn the short way round.
    let from = this.bearing % 360;
    if (toBearing - from > 180) from += 360;
    if (from - toBearing > 180) from -= 360;
    this.camAnim = { fromTilt: this.tilt, toTilt, fromBearing: from, toBearing, start: performance.now(), duration: 650, done };
    if (!this.raf) this.loop();
  }

  // ================= gestures =================

  onPointerDown(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragStart = this.pointers.size === 1 ? { x: e.clientX, y: e.clientY, bearing: this.bearing, moved: false } : undefined;
    this.compassMenu.set(false);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = this.dragStart;
    if (!d || this.pointers.size !== 1) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6 || Math.abs(e.clientY - d.y) > 6) d.moved = true;
    // In the bird's-eye view Leaflet pans the map instead of the camera turning.
    if (this.overview() || this.camAnim) return;
    if (d.moved) {
      this.bearing = (d.bearing + dx * 0.35) % 360;
      this.applyCamera();
    }
  }

  onPointerUp(e: PointerEvent): void {
    const d = this.dragStart;
    this.pointers.delete(e.pointerId);
    if (!d || d.moved || this.pointers.size) {
      if (!this.pointers.size) this.dragStart = undefined;
      return;
    }
    this.dragStart = undefined;
    this.onGroundTap(e.clientX, e.clientY);
  }

  private onGroundTap(clientX: number, clientY: number): void {
    const rect = this.stageRef.nativeElement.getBoundingClientRect();
    if (this.location.demoMode() && this.map) {
      const local = this.unprojectScreen(clientX - rect.left, clientY - rect.top);
      if (local && local.x >= 0 && local.y >= 0 && local.x <= this.size && local.y <= this.size) {
        const ll = this.map.containerPointToLatLng(local);
        this.location.setDemoPosition({ lat: ll.lat, lng: ll.lng });
      }
    } else {
      this.selectedId.set(null);
      this.selectedTower.set(null);
    }
  }

  // ================= compass + bird's-eye view =================

  /** Compass tap: in the bird's-eye view it goes back; otherwise it shows the options. */
  onCompass(): void {
    if (this.overview()) {
      this.exitOverview();
      return;
    }
    this.compassMenu.set(!this.compassMenu());
  }

  pointNorth(): void {
    this.compassMenu.set(false);
    this.animateCamera(this.tilt, 0);
  }

  /** Flatten the camera, zoom out to the whole campus, show labels, and allow panning. */
  enterOverview(): void {
    if (!this.map || this.overview()) return;
    this.compassMenu.set(false);
    this.selectedId.set(null);
    this.selectedTower.set(null);
    this.nearbyOpen.set(false);
    this.savedBearing = this.bearing;
    this.animateCamera(0, 0, () => {
      this.overview.set(true);
      this.layout(); // re-centre the flat map on the screen
      this.labelLayer.addTo(this.map!);
      this.map!.dragging.enable();
      this.map!.flyTo([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], this.campusFitZoom(), { duration: 0.8 });
    });
  }

  /** Back to the tilted explorer view, following the avatar again. */
  exitOverview(): void {
    if (!this.map || !this.overview()) return;
    this.map.dragging.disable();
    this.labelLayer.remove();
    this.overview.set(false);
    this.layout();
    this.map.setView([this.camPos.lat, this.camPos.lng], START_ZOOM, { animate: false });
    this.animateCamera(TILT_DEG, this.savedBearing);
  }

  /** Zoom at which the whole campus fits on screen (with room for the top and bottom bars). */
  private campusFitZoom(): number {
    const map = this.map!;
    const stage = this.stageRef.nativeElement;
    const z = map.getZoom();
    const a = map.project([CAMPUS_BOUNDS[0].lat, CAMPUS_BOUNDS[0].lng], z);
    const b = map.project([CAMPUS_BOUNDS[1].lat, CAMPUS_BOUNDS[1].lng], z);
    const scale = Math.min((stage.clientWidth - 32) / Math.abs(b.x - a.x), (stage.clientHeight - 200) / Math.abs(b.y - a.y));
    const fit = z + Math.log2(scale);
    return Math.max(15, Math.min(19, Math.floor(fit * 4) / 4));
  }

  /** "Where am I?" in the bird's-eye view. */
  findMe(): void {
    this.map?.flyTo([this.camPos.lat, this.camPos.lng], Math.max(this.map.getZoom(), 17.5), { duration: 0.6 });
  }

  // ================= UI actions =================

  private announceInRange(): void {
    this.banner.set("You're inside a missing item's area! Tap the pin.");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.set(null), 3500);
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.nearbyOpen.set(false);
  }

  focus(v: ReportView): void {
    this.select(v.report.id);
  }

  toggleDemo(): void {
    this.location.setDemoMode(!this.location.demoMode());
  }

  /** Explorer card: pick an animal and display name. */
  openPicker(): void {
    this.pickerAvatar.set(this.profile.avatarId());
    this.pickerName.set(this.profile.name());
    this.selectedId.set(null);
    this.selectedTower.set(null);
    this.nearbyOpen.set(false);
    this.pickerOpen.set(true);
  }

  savePicker(): void {
    const avatar = this.pickerAvatar();
    const name = this.pickerName().trim();
    this.profile.update({ avatar, name });
    this.pickerOpen.set(false);
    // Logged in: keep the account in step (best effort; the phone copy is already saved).
    if (this.auth.loggedIn()) {
      void this.auth.updateProfile({ avatar, ...(name ? { displayName: name } : {}) }).catch(() => undefined);
    }
  }

  /** The card's Profile button: achievements and reports live on the Profile tab. */
  openProfile(): void {
    this.pickerOpen.set(false);
    void this.nav.navigateRoot('/tabs/profile');
  }

  avatarHead(a: AvatarPreset): SafeHtml {
    return this.trust(avatarHeadSvg(a));
  }

  avatarFull(id: string): SafeHtml {
    return this.trust(avatarSvg(avatarById(id)));
  }

  /** Our own static SVG strings (no user input), so it is safe to skip sanitizing. */
  private trust(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  async contact(v: ReportView): Promise<void> {
    const r = v.report;
    const atSecurity = r.type === 'found' && r.custody === 'security';
    const alert = await this.alerts.create({
      header: r.type === 'lost' ? 'Found this item?' : 'Is this yours?',
      message: atSecurity
        ? `This item was surrendered to Campus Security. Claim it at the nearest surrender point and describe it to the guard. Reporter: ${r.reporterName} (${r.contact}).`
        : `Reach ${r.reporterName} at ${r.contact} to arrange the return.`,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
