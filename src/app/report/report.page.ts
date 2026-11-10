import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { NavController, ToastController } from '@ionic/angular/lazy';
import * as L from 'leaflet';
import { DEFAULT_RADIUS_M } from '../core/geo';
import { LocationService } from '../core/location.service';
import { CATEGORY_ICON, CATEGORY_LABEL, Category, Custody, LatLng, ReportType } from '../core/report.model';
import { LoginRequiredError, ReportService, StoredReport } from '../core/report.service';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { CAMPUS_CENTER } from '../core/sample-data';

/** One page for both forms: /report/lost and /report/found. */
@Component({
  selector: 'app-report',
  templateUrl: 'report.page.html',
  styleUrls: ['report.page.scss'],
  encapsulation: ViewEncapsulation.None, // the pin is drawn by Leaflet
  standalone: false,
})
export class ReportPage implements AfterViewInit, OnDestroy {
  @ViewChild('pickerEl', { static: true }) private pickerEl!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastController);
  private readonly reports = inject(ReportService);
  private readonly location = inject(LocationService);
  private readonly profile = inject(ProfileService);

  readonly type: ReportType = this.route.snapshot.paramMap.get('type') === 'found' ? 'found' : 'lost';
  readonly isLost = this.type === 'lost';

  readonly categories = Object.keys(CATEGORY_LABEL) as Category[];
  readonly categoryLabel = CATEGORY_LABEL;
  readonly categoryIcon = CATEGORY_ICON;
  readonly radiusOptions = [
    { value: DEFAULT_RADIUS_M, label: 'Exact spot' },
    { value: 50, label: '~50 m' },
    { value: 100, label: '~100 m' },
  ];

  // Form state (signals, so async results like the camera update the view).
  readonly name = signal('');
  readonly category = signal<Category | null>(null);
  readonly description = signal('');
  readonly radius = signal<number>(DEFAULT_RADIUS_M);
  readonly custody = signal<Custody>('with_finder');
  readonly reporterName = signal('');
  readonly contact = signal('');
  readonly pin = signal<LatLng>(CAMPUS_CENTER);

  // Photo flow: preview -> Confirm or Retake.
  readonly preview = signal<string | null>(null);
  readonly photo = signal<string | null>(null);

  readonly saving = signal(false);
  readonly submitted = signal(false);

  readonly missing = computed(() => {
    const m: string[] = [];
    if (!this.name().trim()) m.push('item name');
    if (!this.category()) m.push('category');
    if (!this.isLost && !this.photo()) m.push('photo');
    if (!this.reporterName().trim()) m.push('your name');
    if (!this.contact().trim()) m.push('contact');
    return m;
  });

  private map?: L.Map;
  private marker?: L.Marker;
  private circle?: L.Circle;

  constructor() {
    this.reporterName.set(this.profile.name());
    this.contact.set(this.profile.contact());
  }

  // Both hooks, because Ionic may skip ionViewDidEnter when this URL is opened directly.
  ngAfterViewInit(): void {
    setTimeout(() => this.ionViewDidEnter());
  }

  ionViewDidEnter(): void {
    void this.location.start();
    if (!this.map) this.initPicker(this.location.position() ?? CAMPUS_CENTER);
    this.map?.invalidateSize();
  }

  ionViewWillLeave(): void {
    void this.location.stop();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ---------- photo ----------

  async takePhoto(source: 'camera' | 'gallery'): Promise<void> {
    try {
      const shot = await Camera.getPhoto({
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.DataUrl,
        quality: 50,
        width: 800,
        correctOrientation: true,
      });
      if (shot.dataUrl) this.preview.set(shot.dataUrl);
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? err);
      if (!/cancel/i.test(msg)) void this.toast('Could not open the camera. Check the camera permission.');
    }
  }

  confirmPhoto(): void {
    this.photo.set(this.preview());
    this.preview.set(null);
  }

  retake(): void {
    this.preview.set(null);
    this.photo.set(null);
    void this.takePhoto('camera');
  }

  removePhoto(): void {
    this.photo.set(null);
    this.preview.set(null);
  }

  // ---------- pin picker ----------

  private initPicker(start: LatLng): void {
    this.pin.set(start);
    const map = L.map(this.pickerEl.nativeElement, { zoomControl: false, attributionControl: true }).setView(
      [start.lat, start.lng],
      18,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    this.marker = L.marker([start.lat, start.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'rp-icon',
        html: `<div class="rp-pin rp-pin--${this.type}"></div>`,
        iconSize: [30, 38],
        iconAnchor: [15, 36],
      }),
    }).addTo(map);
    this.marker.on('dragend', () => {
      const p = this.marker!.getLatLng();
      this.movePin({ lat: p.lat, lng: p.lng }, false);
    });

    if (this.isLost) {
      this.circle = L.circle([start.lat, start.lng], {
        radius: this.radius(),
        interactive: false,
        className: 'rp-radius',
      }).addTo(map);
    }

    map.on('click', (e: L.LeafletMouseEvent) => this.movePin({ lat: e.latlng.lat, lng: e.latlng.lng }, false));
    this.map = map;
  }

  private movePin(p: LatLng, pan: boolean): void {
    this.pin.set(p);
    this.marker?.setLatLng([p.lat, p.lng]);
    this.circle?.setLatLng([p.lat, p.lng]);
    if (pan) this.map?.setView([p.lat, p.lng], 18);
  }

  useMyLocation(): void {
    const me = this.location.position();
    if (me) this.movePin(me, true);
    else void this.toast('Location is not available yet. Drag the pin instead.');
  }

  setRadius(value: unknown): void {
    const r = Number(value);
    if (!Number.isFinite(r)) return;
    this.radius.set(r);
    this.circle?.setRadius(r);
  }

  setCategory(value: unknown): void {
    if (typeof value === 'string' && value in CATEGORY_LABEL) this.category.set(value as Category);
  }

  setCustody(value: unknown): void {
    if (value === 'with_finder' || value === 'security') this.custody.set(value);
  }

  // ---------- submit ----------

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.missing().length || this.saving()) return;

    const p = this.pin();
    const report: StoredReport = {
      type: this.type,
      name: this.name().trim(),
      category: this.category()!,
      description: this.description().trim(),
      lat: p.lat,
      lng: p.lng,
      createdAt: new Date().toISOString(),
      reporterName: this.reporterName().trim(),
      contact: this.contact().trim(),
      status: 'active',
    };
    const photo = this.photo();
    if (photo) report.photo = photo;
    if (this.isLost) report.radius = this.radius();
    else report.custody = this.custody();

    this.saving.set(true);
    try {
      await this.reports.add(report);
      this.profile.update({ name: report.reporterName, contact: report.contact });
      await this.toast(this.isLost ? 'Lost item reported. It is now on the map.' : 'Found item reported. Thank you!');
      await this.nav.navigateRoot('/tabs/map');
    } catch (e) {
      if (e instanceof LoginRequiredError) {
        await this.toast('Please log in or sign up to post a report. Your form is kept until you leave this page.');
        await this.nav.navigateForward('/login');
      } else {
        await this.toast(AuthService.message(e).replace('continue as a guest', 'try again later'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async toast(message: string): Promise<void> {
    const t = await this.toasts.create({ message, duration: 2500, position: 'top' });
    await t.present();
  }
}
