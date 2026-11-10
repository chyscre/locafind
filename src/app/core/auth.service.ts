import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProfileService } from './profile.service';

export interface AuthUser {
  id: string;
  studentNo: string;
  displayName: string;
  contact: string;
  avatar: string;
}

interface Session {
  token: string;
  user: AuthUser;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const SESSION_KEY = 'locafind.session';
const GUEST_KEY = 'locafind.guest';

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
  } catch {
    return null;
  }
}

/**
 * Login for LocaFind (backend/api/auth.php). Keeps the login token on the phone and adds
 * it to API requests (see auth.interceptor.ts). Guests can look around but need an
 * account to post, update or delete reports.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly profile = inject(ProfileService);
  readonly endpoint = environment.apiUrl ? `${environment.apiUrl.replace(/\/$/, '')}/auth.php` : '';
  readonly apiBase = environment.apiUrl.replace(/\/$/, '');

  private readonly session = signal<Session | null>(readSession());
  readonly guest = signal(this.readGuest());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly loggedIn = computed(() => !!this.session());

  // ---------- register / login / logout ----------

  async register(studentNo: string, displayName: string, password: string, contact: string): Promise<void> {
    const res = await firstValueFrom(
      this.http
        .post<ApiResponse<Session>>(`${this.endpoint}?action=register`, { studentNo, displayName, password, contact })
        .pipe(timeout(10000)),
    );
    this.start(res.data);
  }

  async login(studentNo: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Session>>(`${this.endpoint}?action=login`, { studentNo, password }).pipe(timeout(10000)),
    );
    this.start(res.data);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.endpoint}?action=logout`, {}).pipe(timeout(5000)));
    } catch {
      /* already logged out on the server, or offline: still log out here */
    }
    this.clear();
    this.profile.update({ name: '', contact: '' });
  }

  continueAsGuest(): void {
    this.setGuest(true);
  }

  /** The server said the token is no longer valid (expired or logged out elsewhere). */
  sessionExpired(): void {
    this.clear();
  }

  /** Re-check the saved login with the server and refresh the profile. */
  async refresh(): Promise<void> {
    if (!this.session()) return;
    try {
      const res = await firstValueFrom(this.http.get<ApiResponse<{ user: AuthUser }>>(this.endpoint).pipe(timeout(8000)));
      this.session.update((s) => (s ? { ...s, user: res.data.user } : s));
      this.save();
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) this.clear();
      // Offline: keep the saved login and try again later.
    }
  }

  /** Save the explorer's name, contact and avatar to the account. */
  async updateProfile(changes: { displayName?: string; contact?: string; avatar?: string }): Promise<void> {
    if (!this.session()) return;
    const res = await firstValueFrom(
      this.http.put<ApiResponse<{ user: AuthUser }>>(this.endpoint, changes).pipe(timeout(8000)),
    );
    this.session.update((s) => (s ? { ...s, user: res.data.user } : s));
    this.save();
  }

  /** A readable message from an API error. */
  static message(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) return "Can't reach the LocaFind server. Check the Wi-Fi, or continue as a guest.";
      const msg = (e.error as { message?: string } | null)?.message;
      if (msg) return msg;
    }
    if (e instanceof Error && e.name === 'TimeoutError') return 'The server took too long to answer. Try again.';
    return 'Something went wrong. Try again.';
  }

  // ---------- internals ----------

  private start(s: Session): void {
    this.session.set(s);
    this.save();
    this.setGuest(false);
    // The account is the source of truth for the explorer's look and name.
    this.profile.update({ name: s.user.displayName, contact: s.user.contact, avatar: s.user.avatar });
  }

  private clear(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session()));
    } catch {
      /* not remembered */
    }
  }

  private setGuest(on: boolean): void {
    this.guest.set(on);
    try {
      localStorage.setItem(GUEST_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private readGuest(): boolean {
    try {
      return localStorage.getItem(GUEST_KEY) === '1';
    } catch {
      return false;
    }
  }
}
