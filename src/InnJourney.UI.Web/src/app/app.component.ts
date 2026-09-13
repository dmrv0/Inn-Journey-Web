import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { ToastsComponent } from './shared/toasts.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastsComponent],
  template: `
    <a class="skip" href="#main">Skip to content</a>

    <header class="masthead">
      <div class="page masthead__inner">
        <a routerLink="/" class="brand" aria-label="Inn Journey, home">
          <span class="brand__mark" aria-hidden="true"></span>
          <span class="brand__name">Inn<span class="brand__thin">Journey</span></span>
        </a>

        <nav class="nav">
          <a routerLink="/search" routerLinkActive="is-active">Find a room</a>

          @if (auth.isOwner()) {
            <a routerLink="/manage" routerLinkActive="is-active">My properties</a>
          }

          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="is-active">Admin</a>
          }

          @if (auth.isSignedIn()) {
            <a routerLink="/account" routerLinkActive="is-active">My stays</a>
            <button type="button" class="linklike" (click)="auth.logout()">Sign out</button>
          } @else {
            <a routerLink="/sign-in" routerLinkActive="is-active">Sign in</a>
            <a routerLink="/register" class="btn btn--sm">Create account</a>
          }
        </nav>
      </div>
    </header>

    <main id="main">
      <router-outlet />
    </main>

    <footer class="footer">
      <div class="page footer__inner">
        <span class="num">INN&mdash;JOURNEY</span>
        <span class="muted">A demonstration booking platform. No real payments are taken.</span>
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
        border-bottom: 1px solid var(--line);
        background: var(--ground);
        position: sticky;
        top: 0;
        z-index: 50;
      }

      .masthead__inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s5);
        min-height: 4rem;
        flex-wrap: wrap;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: var(--s2);
        text-decoration: none;
        color: var(--ink);
      }

      /* Two bars: a stay, and the turnover beside it. */
      .brand__mark {
        width: 1.5rem;
        height: 0.7rem;
        background:
          linear-gradient(to right, var(--lamp) 0 62%, transparent 62% 70%, var(--pool) 70% 100%);
        border-radius: 1px;
      }

      .brand__name {
        font-family: var(--display);
        font-weight: 800;
        letter-spacing: -0.02em;
        font-size: 1.05rem;
      }

      .brand__thin {
        font-weight: 400;
        color: var(--ink-soft);
      }

      .nav {
        display: flex;
        align-items: center;
        gap: var(--s5);
        flex-wrap: wrap;
      }

      .nav a:not(.btn) {
        color: var(--ink-soft);
        text-decoration: none;
        font-size: 0.92rem;
        padding: 0.2rem 0;
        border-bottom: 2px solid transparent;
      }

      .nav a:not(.btn):hover {
        color: var(--ink);
      }

      .nav a.is-active {
        color: var(--ink);
        border-bottom-color: var(--lamp);
      }

      .linklike {
        background: none;
        border: 0;
        padding: 0;
        color: var(--ink-soft);
        font-size: 0.92rem;
        cursor: pointer;
      }

      .linklike:hover {
        color: var(--ink);
      }

      .footer {
        border-top: 1px solid var(--line);
        margin-top: var(--s8);
        padding: var(--s5) 0;
      }

      .footer__inner {
        display: flex;
        justify-content: space-between;
        gap: var(--s4);
        flex-wrap: wrap;
        font-size: 0.82rem;
        letter-spacing: 0.06em;
        color: var(--ink-faint);
      }
    `,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
}
