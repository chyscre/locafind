import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular/lazy';
import { avatarById, avatarSvg } from '../core/avatar';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';
import { ReportService } from '../core/report.service';

type Mode = 'login' | 'register';

/** Log in, sign up, or continue as a guest. */
@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  standalone: false,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly reports = inject(ReportService);
  private readonly nav = inject(NavController);
  private readonly sanitizer = inject(DomSanitizer);

  readonly mode = signal<Mode>('login');
  readonly studentNo = signal('');
  readonly displayName = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly contact = signal('');
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly expired = inject(ActivatedRoute).snapshot.queryParamMap.has('expired');

  readonly mascot = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(avatarSvg(avatarById(this.profile.avatarId()))),
  );

  setMode(value: unknown): void {
    if (value === 'login' || value === 'register') {
      this.mode.set(value);
      this.error.set(null);
    }
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    const studentNo = this.studentNo().trim();
    const password = this.password();
    this.error.set(null);

    if (!studentNo || !password) {
      this.error.set('Enter your student number and password.');
      return;
    }
    if (this.mode() === 'register') {
      if (!this.displayName().trim()) {
        this.error.set('Enter a display name.');
        return;
      }
      if (password.length < 6) {
        this.error.set('Password must be at least 6 characters.');
        return;
      }
      if (password !== this.confirm()) {
        this.error.set('Passwords do not match.');
        return;
      }
    }

    this.busy.set(true);
    try {
      if (this.mode() === 'login') {
        await this.auth.login(studentNo, password);
      } else {
        await this.auth.register(studentNo, this.displayName().trim(), password, this.contact().trim());
      }
      this.password.set('');
      this.confirm.set('');
      void this.reports.load();
      await this.nav.navigateRoot('/tabs/map');
    } catch (e) {
      this.error.set(AuthService.message(e));
    } finally {
      this.busy.set(false);
    }
  }

  async guest(): Promise<void> {
    this.auth.continueAsGuest();
    await this.nav.navigateRoot('/tabs/map');
  }
}
