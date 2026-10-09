import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { IconComponent } from './shared/icon.component';
import { ToastsComponent } from './shared/toasts.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastsComponent, IconComponent],
  template: `
    <a class="skip" href="#main">Skip to content</a>

    <header class="masthead">
      <div class="page--wide masthead__bar">
        <a routerLink="/" class="brand" aria-label="Inn Journey, home" (click)="close()">
          <span class="brand__mark" aria-hidden="true"><i></i><i></i></span>
          <span class="brand__name">Inn Journey</span>
        </a>

        <nav id="main-nav" class="nav" [class.is-open]="menuOpen()" aria-label="Main">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" (click)="close()">Home</a>
          <a routerLink="/search" routerLinkActive="is-active" (click)="close()">Find a stay</a>

          @if (auth.isSignedIn()) {
            <a routerLink="/account" routerLinkActive="is-active" (click)="close()">My stays</a>
          }

          @if (auth.isOwner()) {
            <a routerLink="/manage" routerLinkActive="is-active" (click)="close()">My properties</a>
          } @else if (!auth.isSignedIn()) {
            <a routerLink="/register" (click)="close()">List a property</a>
          }

          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="is-active" (click)="close()">Admin</a>
          }
        </nav>

        <div class="actions">
          @if (auth.isSignedIn()) {
            <button type="button" class="icon-btn" (click)="auth.logout()" title="Sign out">
              <app-icon name="logout" />
              <span class="visually-hidden">Sign out</span>
            </button>
            <a routerLink="/account" class="avatar" [title]="auth.user()?.fullName ?? ''">
              <span aria-hidden="true">{{ initials() }}</span>
              <span class="visually-hidden">My stays</span>
            </a>
          } @else {
            <a routerLink="/sign-in" class="actions__quiet">Sign in</a>
            <a routerLink="/register" class="btn btn--sm">Create account</a>
          }

          <button
            type="button"
            class="icon-btn burger"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="main-nav"
            (click)="toggle()"
          >
            <app-icon [name]="menuOpen() ? 'close' : 'menu'" [size]="20" />
            <span class="visually-hidden">Menu</span>
          </button>
        </div>
      </div>
    </header>

    <main id="main">
      <router-outlet />
    </main>

    <footer class="footer on-night">
      <div class="page--wide footer__inner">
        <div class="footer__lead">
          <span class="brand brand--night">
            <span class="brand__mark" aria-hidden="true"><i></i><i></i></span>
            <span class="brand__name">Inn Journey</span>
          </span>
          <p class="footer__blurb">
            Rooms priced and held by the night, with availability worked out across the
            whole stay rather than a single date.
          </p>
        </div>

        <nav class="footer__cols" aria-label="Footer">
          <div>
            <h4>Book</h4>
            <a routerLink="/search">Find a stay</a>
            <a routerLink="/account">My stays</a>
          </div>
          <div>
            <h4>Account</h4>
            <a routerLink="/sign-in">Sign in</a>
            <a routerLink="/register">Create account</a>
          </div>
          <div>
            <h4>Hosting</h4>
            <a routerLink="/manage">My properties</a>
            <a routerLink="/register">List a property</a>
          </div>
        </nav>
      </div>

      <div class="page--wide">
        <div class="footer__base">
          <span>&copy; {{ year }} Inn Journey</span>
          <span>A demonstration build. Payments are simulated and no card is ever charged.</span>
        </div>
      </div>
    </footer>

    <app-toasts />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      main {
        flex: 1 0 auto;
      }

      .skip {
        position: absolute;
        left: -9999px;
      }

      .skip:focus {
        left: var(--s4);
        top: var(--s4);
        z-index: 200;
        background: var(--ink);
        color: #fff;
        padding: var(--s2) var(--s4);
        border-radius: var(--radius);
      }

      .masthead {
        position: sticky;
        top: 0;
        z-index: 60;
        background: rgb(255 255 255 / 92%);
        backdrop-filter: saturate(160%) blur(12px);
        -webkit-backdrop-filter: saturate(160%) blur(12px);
        border-bottom: 1px solid var(--line);
      }

      .masthead__bar {
        min-height: var(--nav-h);
        display: flex;
        align-items: center;
        gap: var(--s6);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        text-decoration: none;
        color: var(--ink);
        flex: 0 0 auto;
      }

      /* Two bars on violet: a stay, and the next one starting the morning it ends. */
      .brand__mark {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 7px;
        background: var(--pool);
        display: inline-flex;
        flex-direction: column;
        justify-content: center;
        gap: 3px;
        padding: 0 5px;
      }

      .brand__mark i {
        display: block;
        height: 4px;
        border-radius: 2px;
        background: #fff;
      }

      .brand__mark i:first-child {
        width: 70%;
      }

      .brand__mark i:last-child {
        width: 55%;
        margin-left: auto;
        opacity: 0.7;
      }

      .brand__name {
        font-weight: 700;
        font-size: 1.12rem;
        letter-spacing: -0.03em;
      }

      .brand--night {
        color: var(--on-night);
      }

      .nav {
        display: flex;
        align-items: center;
        gap: var(--s6);
        margin-right: auto;
      }

      .nav a {
        font-size: 0.92rem;
        font-weight: 500;
        color: var(--ink-soft);
        text-decoration: none;
        white-space: nowrap;
        padding: 0.4rem 0;
      }

      .nav a:hover {
        color: var(--ink);
      }

      .nav a.is-active {
        color: var(--pool);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: var(--s3);
        flex: 0 0 auto;
      }

      .actions__quiet {
        font-size: 0.92rem;
        color: var(--ink);
        text-decoration: none;
        padding: 0.4rem 0.6rem;
      }

      .icon-btn {
        width: 2.5rem;
        height: 2.5rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-pill);
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink-soft);
        cursor: pointer;
      }

      .icon-btn:hover {
        color: var(--ink);
        border-color: var(--line-strong);
      }

      .avatar {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--pool-soft);
        color: var(--pool-deep);
        font-size: 0.85rem;
        font-weight: 700;
        text-decoration: none;
        box-shadow: inset 0 0 0 1px var(--pool-line);
      }

      .burger {
        display: none;
      }

      /* --- Footer ---------------------------------------------------------- */

      .footer {
        margin-top: var(--s8);
        padding: var(--s7) 0 0;
      }

      .footer__inner {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s7);
        justify-content: space-between;
      }

      .footer__lead {
        flex: 1 1 18rem;
        max-width: 24rem;
      }

      .footer__blurb {
        margin: var(--s4) 0 0;
        color: var(--on-night-soft);
        font-size: 0.92rem;
      }

      .footer__cols {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s5) var(--s8);
      }

      .footer__cols div {
        display: flex;
        flex-direction: column;
        gap: var(--s3);
      }

      .footer__cols h4 {
        font-size: 0.95rem;
        font-weight: 600;
        margin: 0 0 var(--s1);
      }

      .footer__cols a {
        font-size: 0.9rem;
      }

      .footer__base {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--s3);
        margin-top: var(--s7);
        padding-top: var(--s5);
        padding-bottom: var(--s5);
        border-top: 1px solid var(--night-line);
        font-size: 0.82rem;
        color: var(--on-night-soft);
      }

      @media (max-width: 900px) {
        .masthead__bar {
          flex-wrap: wrap;
          gap: var(--s3);
        }

        .nav {
          order: 3;
          width: 100%;
          display: none;
          flex-direction: column;
          align-items: stretch;
          gap: 0;
          padding: 0 0 var(--s3);
          margin: 0;
        }

        .nav a {
          padding: var(--s3) 0;
          border-top: 1px solid var(--line);
        }

        .nav.is-open {
          display: flex;
        }

        .actions {
          margin-left: auto;
        }

        .actions__quiet {
          display: none;
        }

        .burger {
          display: inline-flex;
        }
      }
    `,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('')
  );

  protected toggle(): void {
    this.menuOpen.update((open) => !open);
  }

  protected close(): void {
    this.menuOpen.set(false);
  }
}
