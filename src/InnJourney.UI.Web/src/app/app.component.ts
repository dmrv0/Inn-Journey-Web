import { Component, inject, signal } from '@angular/core';
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
      <div class="masthead__pill on-night">
        <a routerLink="/" class="brand" aria-label="Inn Journey, home">
          <span class="brand__mark" aria-hidden="true"></span>
          <span class="brand__name">Inn<span class="brand__thin">Journey</span></span>
        </a>

        <nav id="main-nav" class="nav" [class.is-open]="menuOpen()" aria-label="Main">
          <a routerLink="/search" routerLinkActive="is-active" (click)="close()">Find a room</a>

          @if (auth.isOwner()) {
            <a routerLink="/manage" routerLinkActive="is-active" (click)="close()">My properties</a>
          }

          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="is-active" (click)="close()">Admin</a>
          }

          @if (auth.isSignedIn()) {
            <a routerLink="/account" routerLinkActive="is-active" (click)="close()">My stays</a>
          }
        </nav>

        <div class="actions">
          @if (auth.isSignedIn()) {
            <button type="button" class="btn btn--sm btn--pill btn--night" (click)="auth.logout()">
              Sign out
            </button>
          } @else {
            <a routerLink="/sign-in" class="actions__quiet">Sign in</a>
            <a routerLink="/register" class="btn btn--sm btn--pill btn--night">Create account</a>
          }

          <button
            type="button"
            class="burger"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="main-nav"
            (click)="toggle()"
          >
            <span class="visually-hidden">Menu</span>
            <span class="burger__bar" aria-hidden="true"></span>
            <span class="burger__bar" aria-hidden="true"></span>
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
          <span class="brand__mark" aria-hidden="true"></span>
          <p class="footer__blurb">
            Rooms priced and held by the night, with availability worked out across the
            whole span rather than a single date.
          </p>
        </div>

        <nav class="footer__cols" aria-label="Footer">
          <div>
            <h4>Book</h4>
            <a routerLink="/search">Find a room</a>
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
          </div>
        </nav>
      </div>

      <p class="footer__note page--wide">
        A demonstration booking platform. Payments are simulated and no card is ever
        charged or stored.
      </p>

      <span class="footer__wordmark" aria-hidden="true">Inn Journey</span>
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
        padding-top: var(--nav-h);
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

      /* The nav floats: out of flow, so a hero can run full-bleed behind it. */
      .masthead {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 60;
        padding: var(--s4) var(--s5) 0;
        pointer-events: none;
      }

      .masthead__pill {
        pointer-events: auto;
        max-width: var(--page-wide);
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: var(--s5);
        padding: 0.55rem 0.6rem 0.55rem 1.15rem;
        border-radius: var(--radius-pill);
        background: rgb(11 22 20 / 82%);
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        border: 1px solid var(--night-line);
        box-shadow: 0 10px 30px -14px rgb(11 22 20 / 55%);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: var(--s2);
        text-decoration: none;
        color: var(--on-night);
        flex: 0 0 auto;
      }

      /* Two bars: a stay, and the turnover beside it. */
      .brand__mark {
        width: 1.5rem;
        height: 0.7rem;
        background: linear-gradient(
          to right,
          var(--lamp) 0 62%,
          transparent 62% 70%,
          #6fb3ab 70% 100%
        );
        border-radius: 1px;
        flex: 0 0 auto;
        display: block;
      }

      .brand__name {
        font-family: var(--display);
        font-weight: 800;
        letter-spacing: -0.02em;
        font-size: 1.02rem;
        color: var(--on-night);
      }

      .brand__thin {
        font-weight: 400;
        color: var(--on-night-soft);
      }

      .nav {
        display: flex;
        align-items: center;
        gap: var(--s5);
        margin-right: auto;
      }

      .nav a {
        font-size: 0.9rem;
        padding: 0.3rem 0;
        border-bottom: 2px solid transparent;
        white-space: nowrap;
      }

      .nav a.is-active {
        color: var(--on-night);
        border-bottom-color: var(--lamp);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: var(--s3);
        flex: 0 0 auto;
      }

      .actions__quiet {
        font-size: 0.9rem;
        color: var(--on-night-soft);
        text-decoration: none;
        white-space: nowrap;
      }

      .actions__quiet:hover {
        color: var(--on-night);
      }

      .burger {
        display: none;
        width: 2.4rem;
        height: 2.4rem;
        border-radius: var(--radius-pill);
        border: 1px solid var(--night-line);
        background: transparent;
        cursor: pointer;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }

      .burger__bar {
        display: block;
        width: 1rem;
        height: 1.5px;
        background: var(--on-night);
      }

      /* --- Footer ---------------------------------------------------------- */

      .footer {
        position: relative;
        margin-top: var(--s8);
        padding: var(--s7) 0 0;
        overflow: hidden;
      }

      .footer__inner {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s7);
        justify-content: space-between;
      }

      .footer__lead {
        flex: 1 1 20rem;
        max-width: 28rem;
      }

      .footer__blurb {
        margin: var(--s3) 0 0;
        color: var(--on-night-soft);
        font-size: 0.92rem;
      }

      .footer__cols {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s7);
      }

      .footer__cols div {
        display: flex;
        flex-direction: column;
        gap: var(--s2);
      }

      .footer__cols h4 {
        font-family: var(--mono);
        font-size: 0.7rem;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--on-night-soft);
        margin: 0 0 var(--s1);
      }

      .footer__cols a {
        font-size: 0.92rem;
      }

      .footer__note {
        margin: var(--s7) auto var(--s6);
        padding-top: var(--s4);
        border-top: 1px solid var(--night-line);
        font-size: 0.8rem;
        color: var(--on-night-soft);
      }

      /* A watermark, not a heading: it is cropped by the viewport on purpose and
         should never compete with the links above it. */
      .footer__wordmark {
        display: block;
        font-family: var(--display);
        font-weight: 800;
        font-size: clamp(3.5rem, 13vw, 11rem);
        line-height: 0.82;
        letter-spacing: -0.045em;
        color: rgb(255 255 255 / 6%);
        text-align: center;
        white-space: nowrap;
        user-select: none;
        margin-bottom: -0.16em;
      }

      @media (max-width: 860px) {
        .masthead__pill {
          flex-wrap: wrap;
          gap: var(--s3);
          border-radius: var(--radius-xl);
          padding: 0.6rem 0.7rem 0.6rem 1rem;
        }

        .nav {
          order: 3;
          width: 100%;
          display: none;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--s3);
          padding: var(--s3) 0 var(--s2);
          margin: 0;
          border-top: 1px solid var(--night-line);
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
          display: flex;
        }
      }
    `,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);

  protected toggle(): void {
    this.menuOpen.update((open) => !open);
  }

  protected close(): void {
    this.menuOpen.set(false);
  }
}
