import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';
import { ToastService, fieldErrors } from '../core/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page wrap">
      <div class="card panel">
        <p class="eyebrow">Get started</p>
        <h1>Create an account</h1>

        <form (ngSubmit)="submit()" #form="ngForm">
          <fieldset class="roles">
            <legend>I want to</legend>

            <label class="role" [class.role--on]="role === 'Traveller'">
              <input type="radio" name="role" value="Traveller" [(ngModel)]="role" />
              <span class="role__name">Book a room</span>
              <span class="role__desc muted">Search properties, book stays, leave reviews.</span>
            </label>

            <label class="role" [class.role--on]="role === 'HotelOwner'">
              <input type="radio" name="role" value="HotelOwner" [(ngModel)]="role" />
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

          <button class="btn wide" type="submit" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Creating…' : 'Create account' }}
          </button>
        </form>

        <p class="muted small">
          Already have one? <a routerLink="/sign-in">Sign in</a>.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: var(--s7) var(--s5);
        display: flex;
        justify-content: center;
      }

      .panel {
        padding: var(--s6);
        width: min(30rem, 100%);
      }

      .roles {
        border: 0;
        padding: 0;
        margin: 0 0 var(--s5);
        display: grid;
        gap: var(--s2);
      }

      .roles legend {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--ink-soft);
        margin-bottom: var(--s2);
        padding: 0;
      }

      .role {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-areas: 'radio name' 'radio desc';
        gap: 0 var(--s3);
        padding: var(--s3);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        cursor: pointer;
      }

      .role input {
        grid-area: radio;
        align-self: center;
      }

      .role__name {
        grid-area: name;
        font-weight: 600;
        font-size: 0.95rem;
      }

      .role__desc {
        grid-area: desc;
        font-size: 0.82rem;
      }

      .role--on {
        border-color: var(--pool);
        background: var(--pool-soft);
      }

      .hint {
        font-size: 0.78rem;
        margin: var(--s1) 0 0;
      }

      .wide {
        width: 100%;
      }

      .small {
        font-size: 0.85rem;
      }
    `,
  ],
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

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
