import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AlertController, ToastController } from '@ionic/angular/lazy';
import { AVATARS, AvatarPreset, avatarById, avatarHeadSvg, avatarSvg } from '../core/avatar';
import { LocationService } from '../core/location.service';
import { ProfileService } from '../core/profile.service';
import { CATEGORY_ICON, CUSTODY_LABEL, Report } from '../core/report.model';
import { ReportService } from '../core/report.service';

interface Badge {
  id: string;
  name: string;
  icon: string;
  how: string;
  /** Current progress and the goal, e.g. 2 of 5. */
  value: number;
  goal: number;
}

/**
 * The explorer's profile: their avatar and name, achievements earned from their reports,
 * the reports themselves (with status updates), and Demo mode for testing off campus.
 */
@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  readonly profile = inject(ProfileService);
  readonly reports = inject(ReportService);
  readonly location = inject(LocationService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly sanitizer = inject(DomSanitizer);

  readonly avatars = AVATARS;
  readonly icon = CATEGORY_ICON;
  readonly custodyLabel = CUSTODY_LABEL;

  // Inline editor
  readonly editing = signal(false);
  readonly draftAvatar = signal('kitty');
  readonly draftName = signal('');
  readonly draftContact = signal('');

  readonly heroSvg = computed<SafeHtml>(() =>
    this.trust(avatarSvg(this.editing() ? avatarById(this.draftAvatar()) : this.profile.avatar())),
  );

  /** Numbers shown on the profile, all from reports made on this phone. */
  readonly stats = computed(() => {
    const mine = this.reports.mine();
    const found = mine.filter((r) => r.type === 'found');
    const lost = mine.filter((r) => r.type === 'lost');
    return {
      returned: found.filter((r) => r.custody === 'returned' || r.status === 'recovered').length,
      surrendered: found.filter((r) => r.custody === 'security' || r.custody === 'returned').length,
      gotBack: lost.filter((r) => r.status === 'recovered').length,
      total: mine.length,
    };
  });

  readonly badges = computed<Badge[]>(() => {
    const s = this.stats();
    return [
      { id: 'first', name: 'First Report', icon: 'flag', how: 'Make your first report', value: Math.min(s.total, 1), goal: 1 },
      { id: 'samaritan', name: 'Good Samaritan', icon: 'heart', how: 'Return 1 found item', value: Math.min(s.returned, 1), goal: 1 },
      { id: 'trusty', name: 'Trusty Finder', icon: 'shield-checkmark', how: 'Surrender 1 item to security', value: Math.min(s.surrendered, 1), goal: 1 },
      { id: 'reunited', name: 'Reunited', icon: 'sparkles', how: 'Get a lost item back', value: Math.min(s.gotBack, 1), goal: 1 },
      { id: 'hero', name: 'Campus Hero', icon: 'trophy', how: 'Return 5 found items', value: Math.min(s.returned, 5), goal: 5 },
      { id: 'reporter', name: 'Eagle Eye', icon: 'eye', how: 'Make 10 reports', value: Math.min(s.total, 10), goal: 10 },
    ];
  });

  readonly earned = computed(() => this.badges().filter((b) => b.value >= b.goal).length);

  ngOnInit(): void {
    this.ionViewWillEnter();
  }

  ionViewWillEnter(): void {
    if (!this.reports.reports().length) void this.reports.load();
  }

  // ---------- explorer editor ----------

  startEdit(): void {
    this.draftAvatar.set(this.profile.avatarId());
    this.draftName.set(this.profile.name());
    this.draftContact.set(this.profile.contact());
    this.editing.set(true);
  }

  saveEdit(): void {
    this.profile.update({
      avatar: this.draftAvatar(),
      name: this.draftName().trim(),
      contact: this.draftContact().trim(),
    });
    this.editing.set(false);
  }

  head(a: AvatarPreset): SafeHtml {
    return this.trust(avatarHeadSvg(a));
  }

  /** Our own static SVG strings (no user input), so it is safe to skip sanitizing. */
  private trust(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  // ---------- demo mode ----------

  setDemo(on: boolean): void {
    this.location.setDemoMode(on);
  }

  /** Test anywhere: drop pretend items around the phone's current position. */
  async placeTestItems(): Promise<void> {
    await this.location.start();
    const me = this.location.position();
    const t = await this.toasts.create({
      message: me
        ? 'Test items placed around you. Open the Map and walk toward them.'
        : 'Location is not available yet. Turn on location (or Demo mode) and try again.',
      duration: 2800,
      position: 'top',
    });
    if (me) this.reports.placeTestItems(me);
    await t.present();
  }

  clearTestItems(): void {
    this.reports.clearTestItems();
  }

  // ---------- my reports ----------

  async markSurrendered(r: Report): Promise<void> {
    await this.run(() => this.reports.setCustody(r.id, 'security'), 'Marked as surrendered to Campus Security.');
  }

  async markRecovered(r: Report): Promise<void> {
    const alert = await this.alerts.create({
      header: r.type === 'lost' ? 'Got it back?' : 'Returned to the owner?',
      message: 'The report will be closed and removed from the map.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes, close it',
          handler: () => {
            void this.run(async () => {
              if (r.type === 'found') await this.reports.setCustody(r.id, 'returned');
              await this.reports.setStatus(r.id, 'recovered');
            }, r.type === 'found' ? 'Nice! Item returned.' : 'Report closed. Glad you found it!');
          },
        },
      ],
    });
    await alert.present();
  }

  private async run(action: () => Promise<void>, done: string): Promise<void> {
    let message = done;
    try {
      await action();
    } catch {
      message = 'Could not update. Check your internet connection and try again.';
    }
    const t = await this.toasts.create({ message, duration: 2000, position: 'top' });
    await t.present();
  }
}
