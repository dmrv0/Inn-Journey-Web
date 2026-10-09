import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { unsplash } from '../core/photos';
import { Role } from '../core/models';
import { ToastService, fieldErrors } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page--wide auth">
      <div class="auth__panel">
        <h1>Create an account</h1>
        <p class="muted">Book stays as a guest, or list a property you run.</p>

        <form (ngSubmit)="submit()" #form="ngForm">
          <fieldset class="roles">
            <legend>I want to</legend>

            <label class="role" [class.role--on]="role === 'Traveller'">
              <input type="radio" name="role" value="Traveller" [(ngModel)]="role" />
              <span class="role__icon"><app-icon name="bed" [size]="20" /></span>
              <span class="role__name">Book a room</span>
              <span class="role__desc muted">Search properties, book stays, leave reviews.</span>
            </label>

            <label class="role" [class.role--on]="role === 'HotelOwner'">
              <input type="radio" name="role" value="HotelOwner" [(ngModel)]="role" />
              <span class="role__icon"><app-icon name="building" [size]="20" /></span>
              <span class="role__name">List a property</span>
              <span class="role__desc muted">Manage rooms, rates, bookings and revenue.</span>
            </label>
          </fieldset>

          <div class="field">
            <label for="name">Full name</label>
            <input
              id="name"
              class="input"
              name="fullName"
              [(ngModel)]="fullName"
              required
              autocomplete="name"
            />
            @if (errors()['fullName']) {
              <p class="error-text">{{ errors()['fullName'] }}</p>
            }
          </div>

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
            @if (errors()['email']) {
              <p class="error-text">{{ errors()['email'] }}</p>
            }
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
              minlength="8"
              autocomplete="new-password"
            />
            <p class="hint muted">
              At least 8 characters, with an upper case letter, a lower case letter and a
              digit.
            </p>
            @if (errors()['password']) {
              <p class="error-text">{{ errors()['password'] }}</p>
            }
          </div>

          @if (generalError()) {
            <p class="error-text" role="alert">{{ generalError() }}</p>
          }

          <button class="btn btn--lg btn--block" type="submit" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Creating…' : 'Create account' }}
          </button>
        </form>

        <p class="muted small switch">
          Already have one? <a routerLink="/sign-in">Sign in</a>.
        </p>
      </div>

      <div class="auth__photo" [style.background-image]="'url(' + photo + ')'" aria-hidden="true">
        <p>Search by the nights you need. Book in a few steps.</p>
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

      .roles {
        border: 0;
        padding: 0;
        margin: 0 0 var(--s5);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s3);
      }

      .roles legend {
        font-size: 0.84rem;
        font-weight: 500;
        color: var(--ink-soft);
        margin-bottom: var(--s2);
        padding: 0;
      }

      .role {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--s1);
        padding: var(--s4);
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease;
      }

      .role input {
        position: absolute;
        top: var(--s4);
        right: var(--s4);
      }

      .role__icon {
        color: var(--ink-soft);
        margin-bottom: var(--s2);
      }

      .role__name {
        font-weight: 600;
        font-size: 0.95rem;
      }

      .role__desc {
        font-size: 0.82rem;
        line-height: 1.45;
      }

      .role--on {
        border-color: var(--pool);
        background: var(--pool-soft);
      }

      .role--on .role__icon {
        color: var(--pool);
      }

      .hint {
        font-size: 0.8rem;
        margin: var(--s1) 0 0;
      }

      @media (max-width: 420px) {
        .roles {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly photo = unsplash('1566073771259-6a8506099945', 1400);

  protected fullName = '';
  protected email = '';
  protected password = '';
  protected role: Role = 'Traveller';

  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly generalError = signal('');

  protected submit(): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.errors.set({});
    this.generalError.set('');

    this.auth
      .register({
        email: this.email,
        password: this.password,
        fullName: this.fullName,
        role: this.role,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toasts.success('Account created. Welcome.');
          void this.router.navigateByUrl(this.role === 'HotelOwner' ? '/manage' : '/search');
        },
        error: (err) => {
          this.busy.set(false);

          const fields = fieldErrors(err);
          this.errors.set(fields);

          if (Object.keys(fields).length === 0) {
            this.generalError.set(
              err?.status === 409
                ? 'An account with that email address already exists.'
                : 'Could not create the account. Check the details and try again.'
            );
          }
        },
      });
  }
}
