import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthResponse, Role, User } from './models';

const ACCESS_TOKEN = 'inn.accessToken';
const REFRESH_TOKEN = 'inn.refreshToken';
const USER = 'inn.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly currentUser = signal<User | null>(this.readStoredUser());

  readonly user = this.currentUser.asReadonly();
  readonly isSignedIn = computed(() => this.currentUser() !== null);
  readonly isOwner = computed(() => this.hasRole('HotelOwner'));
  readonly isAdmin = computed(() => this.hasRole('Admin'));

  hasRole(role: Role): boolean {
    const roles = this.currentUser()?.roles ?? [];
    // Admin satisfies every policy, matching the API's authorization rules.
    return roles.includes(role) || roles.includes('Admin');
  }

  get accessToken(): string | null {
    return this.read(ACCESS_TOKEN);
  }

  get refreshToken(): string | null {
    return this.read(REFRESH_TOKEN);
  }

  register(body: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/register`, body)
      .pipe(tap((res) => this.store(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/login`, { email, password })
      .pipe(tap((res) => this.store(res)));
  }

  /** Exchanges the stored refresh token for a fresh pair. */
  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/refresh`, { refreshToken: this.refreshToken })
      .pipe(tap((res) => this.store(res)));
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.base}/forgot-password`, { email });
  }

  resetPassword(body: { email: string; token: string; newPassword: string }) {
    return this.http.post(`${this.base}/reset-password`, body);
  }

  logout(redirectTo: string | null = '/'): void {
    // Tell the API to drop the refresh token, but clear locally regardless:
    // a failed call must not leave the browser holding credentials.
    if (this.accessToken) {
      this.http.post(`${this.base}/logout`, {}).subscribe({
        error: () => undefined,
      });
    }

    this.clear();

    if (redirectTo) {
      void this.router.navigateByUrl(redirectTo);
    }
  }

  store(res: AuthResponse): void {
    this.write(ACCESS_TOKEN, res.accessToken);
    this.write(REFRESH_TOKEN, res.refreshToken);
    this.write(USER, JSON.stringify(res.user));
    this.currentUser.set(res.user);
  }

  clear(): void {
    [ACCESS_TOKEN, REFRESH_TOKEN, USER].forEach((k) => this.remove(k));
    this.currentUser.set(null);
  }

  private readStoredUser(): User | null {
    const raw = this.read(USER);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  // localStorage throws in some privacy modes, so every access is guarded.
  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
