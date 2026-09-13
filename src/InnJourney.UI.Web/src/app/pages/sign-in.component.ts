import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ToastService, describeError } from '../core/toast.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page auth">
      <div class="auth__panel card">
        <p class="eyebrow">Welcome back</p>
        <h1>Sign in</h1>

        @if (expired()) {
          <p class="notice">Your session ended. Sign in again to carry on.</p>
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

          <button class="btn auth__go" type="submit" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="muted small">
          No account yet? <a routerLink="/register">Create one</a>.
        </p>
      </div>

      <aside class="auth__demo">
        <h2 class="demo__title">Try it without signing up</h2>
        <p class="muted small">
          This is a demonstration build. Pick an account to see the product from that
          side.
        </p>

        <ul class="demo__list">
          @for (account of demoAccounts; track account.email) {
            <li>
              <button type="button" class="demo__btn" (click)="useDemo(account.email)">
                <span class="demo__role num">{{ account.role }}</span>
                <span class="demo__email">{{ account.email }}</span>
                <span class="muted small">{{ account.can }}</span>
              </button>
            </li>
          }
        </ul>
      </aside>
    </div>
  `,
  styles: [
    `
      .auth {
        display: grid;
        grid-template-columns: minmax(0, 24rem) minmax(0, 22rem);
        gap: var(--s6);
        padding: var(--s7) var(--s5);
        align-items: start;
        justify-content: center;
      }

      @media (max-width: 800px) {
        .auth {
          grid-template-columns: 1fr;
        }
      }

      .auth__panel {
        padding: var(--s6);
      }

      .auth__go {
        width: 100%;
      }

      .notice {
        background: var(--lamp-soft);
        border-left: 3px solid var(--lamp);
        padding: var(--s3);
        font-size: 0.88rem;
        margin-bottom: var(--s4);
      }

      .small {
        font-size: 0.85rem;
      }

      .auth__demo {
        padding: var(--s5);
        border: 1px dashed var(--line);
        border-radius: var(--radius-lg);
      }

      .demo__title {
        font-size: 1rem;
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
        display: grid;
        gap: 2px;
        padding: var(--s3);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        cursor: pointer;
      }

      .demo__btn:hover {
        border-color: var(--pool);
      }

      .demo__role {
        font-size: 0.68rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--lamp);
      }

      .demo__email {
        font-size: 0.9rem;
        font-weight: 600;
      }
    `,
  ],
})
export class SignInComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  protected email = '';
  protected password = '';

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly expired = signal(
    this.route.snapshot.queryParamMap.get('expired') === 'true'
  );

  /** Documented in the README; these exist only in the seeded demo database. */
  protected readonly demoAccounts = [
    { role: 'Traveller', email: 'guest@innjourney.dev', can: 'Book, pay, review' },
    { role: 'Hotel owner', email: 'owner@innjourney.dev', can: 'Manage properties and bookings' },
    { role: 'Admin', email: 'admin@innjourney.dev', can: 'Everything, plus catalogues' },
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
