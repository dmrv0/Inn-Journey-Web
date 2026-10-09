import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { unsplash } from '../core/photos';
import { ToastService, describeError } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page--wide auth">
      <div class="auth__panel">
        <h1>Welcome back</h1>
        <p class="muted">Sign in to see your stays, or to manage your properties.</p>

        @if (expired()) {
          <p class="notice notice--held">Your session ended. Sign in again to carry on.</p>
        }

        <form (ngSubmit)="submit()" #form="ngForm">
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              class="input"
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              autocomplete="email"
            />
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              class="input"
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              autocomplete="current-password"
            />
          </div>

          @if (error()) {
            <p class="error-text" role="alert">{{ error() }}</p>
          }

          <button class="btn btn--lg btn--block" type="submit" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="muted small switch">
          No account yet? <a routerLink="/register">Create one</a>.
        </p>

        <section class="demo" aria-labelledby="demo-title">
          <h2 id="demo-title" class="demo__title">Try it without signing up</h2>
          <p class="muted small">Pick a demonstration account to see the product from that side.</p>

        <ul class="demo__list">
          @for (account of demoAccounts; track account.email) {
            <li>
              <button type="button" class="demo__btn" (click)="useDemo(account.email)">
                <span class="demo__icon"><app-icon [name]="account.icon" [size]="18" /></span>
                <span class="demo__text">
                  <strong>{{ account.role }}</strong>
                  <span class="muted">{{ account.can }}</span>
                </span>
                <app-icon class="demo__go" name="chevron-right" [size]="16" />
              </button>
            </li>
          }
        </ul>
        </section>
      </div>

      <div class="auth__photo" [style.background-image]="'url(' + photo + ')'" aria-hidden="true">
        <p>Rooms held by the night, from the evening you arrive to the morning you leave.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .auth {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
        gap: clamp(2rem, 6vw, 5rem);
        padding-top: var(--s7);
        align-items: stretch;
      }

      .auth__panel {
        width: min(27rem, 100%);
        justify-self: center;
        padding: var(--s5) 0;
      }

      .auth__panel h1 {
        font-size: clamp(1.7rem, 1.4rem + 1vw, 2.2rem);
        margin-bottom: var(--s2);
      }

      .auth__panel > .muted {
        margin-bottom: var(--s6);
      }

      .auth__photo {
        position: relative;
        min-height: 36rem;
        border-radius: var(--radius-xl);
        background-size: cover;
        background-position: center;
        overflow: hidden;
        display: flex;
        align-items: flex-end;
      }

      .auth__photo::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgb(10 12 28 / 72%), transparent 55%);
      }

      .auth__photo p {
        position: relative;
        margin: 0;
        padding: var(--s6);
        color: #fff;
        font-size: 1.3rem;
        font-weight: 500;
        letter-spacing: -0.015em;
        line-height: 1.35;
        max-width: 24ch;
      }

      .small {
        font-size: 0.88rem;
      }

      .switch {
        margin-top: var(--s4);
        text-align: center;
      }

      @media (max-width: 860px) {
        .auth {
          grid-template-columns: 1fr;
          padding-top: var(--s5);
        }

        .auth__photo {
          display: none;
        }
      }

      .demo {
        margin-top: var(--s6);
        padding-top: var(--s5);
        border-top: 1px solid var(--line);
      }

      .demo__title {
        font-size: 1rem;
        margin-bottom: var(--s1);
      }

      .demo__list {
        list-style: none;
        padding: 0;
        margin: var(--s4) 0 0;
        display: grid;
        gap: var(--s2);
      }

      .demo__btn {
        width: 100%;
        text-align: left;
        display: flex;
        align-items: center;
        gap: var(--s3);
        padding: var(--s3);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease;
      }

      .demo__btn:hover {
        border-color: var(--pool-line);
        background: var(--pool-soft);
      }

      .demo__icon {
        width: 2.4rem;
        height: 2.4rem;
        flex: 0 0 auto;
        border-radius: var(--radius);
        background: var(--pool-soft);
        color: var(--pool);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .demo__text {
        display: flex;
        flex-direction: column;
        line-height: 1.35;
        font-size: 0.9rem;
        flex: 1 1 auto;
      }

      .demo__go {
        color: var(--ink-faint);
      }
    `,
  ],
})
export class SignInComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  protected readonly photo = unsplash('1596394516093-501ba68a0ba6', 1400);

  protected email = '';
  protected password = '';

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly expired = signal(
    this.route.snapshot.queryParamMap.get('expired') === 'true'
  );

  /** Documented in the README; these exist only in the seeded demo database. */
  protected readonly demoAccounts = [
    { role: 'Traveller', email: 'guest@innjourney.dev', can: 'Book, pay, review', icon: 'user' },
    { role: 'Hotel owner', email: 'owner@innjourney.dev', can: 'Manage properties and bookings', icon: 'building' },
    { role: 'Admin', email: 'admin@innjourney.dev', can: 'Everything, plus catalogues', icon: 'key' },
  ];

  protected useDemo(email: string): void {
    this.email = email;
    this.password = 'Passw0rd!';
    this.submit();
  }

  protected submit(): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.busy.set(false);
        this.toasts.success('Signed in.');

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl || '/');
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(describeError(err, 'Email address or password is incorrect.'));
      },
    });
  }
}
