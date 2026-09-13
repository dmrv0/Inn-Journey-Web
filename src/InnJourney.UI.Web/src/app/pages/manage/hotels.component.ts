import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { formatMoney } from '../../core/dates';
import { Amenity, HotelSummary } from '../../core/models';
import { ToastService, fieldErrors } from '../../core/toast.service';
import { StarsComponent } from '../../shared/stars.component';

@Component({
  selector: 'app-manage-hotels',
  standalone: true,
  imports: [FormsModule, RouterLink, StarsComponent],
  template: `
    <div class="page wrap">
      <header class="head">
        <div>
          <p class="eyebrow">Owner</p>
          <h1>My properties</h1>
        </div>

        <button class="btn" type="button" (click)="showForm.set(!showForm())">
          {{ showForm() ? 'Close' : 'Add a property' }}
        </button>
      </header>

      @if (showForm()) {
        <section class="card form">
          <h2>New property</h2>

          <form (ngSubmit)="create()" #f="ngForm">
            <div class="row">
              <div class="field">
                <label for="name">Name</label>
                <input id="name" class="input" name="name" [(ngModel)]="draft.name" required />
                @if (errors()['name']) {
                  <p class="error-text">{{ errors()['name'] }}</p>
                }
              </div>
              <div class="field narrow">
                <label for="stars">Stars</label>
                <select id="stars" class="input" name="stars" [(ngModel)]="draft.stars">
                  @for (s of [1, 2, 3, 4, 5]; track s) {
                    <option [ngValue]="s">{{ s }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="field">
              <label for="desc">Description</label>
              <textarea id="desc" class="input" rows="3" name="description" [(ngModel)]="draft.description"></textarea>
            </div>

            <div class="row">
              <div class="field">
                <label for="line">Street address</label>
                <input id="line" class="input" name="addressLine" [(ngModel)]="draft.addressLine" required />
              </div>
              <div class="field">
                <label for="city">City</label>
                <input id="city" class="input" name="city" [(ngModel)]="draft.city" required />
              </div>
              <div class="field">
                <label for="country">Country</label>
                <input id="country" class="input" name="country" [(ngModel)]="draft.country" required />
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label for="phone">Phone</label>
                <input id="phone" class="input" name="phone" [(ngModel)]="draft.phone" />
              </div>
              <div class="field">
                <label for="email">Email</label>
                <input id="email" class="input" type="email" name="email" [(ngModel)]="draft.email" />
              </div>
            </div>

            @if (amenities().length) {
              <fieldset class="amenities">
                <legend>Facilities</legend>
                @for (a of amenities(); track a.id) {
                  <label class="check">
                    <input type="checkbox" [checked]="selected().has(a.id)" (change)="toggle(a.id)" />
                    {{ a.name }}
                  </label>
                }
              </fieldset>
            }

            <button class="btn" type="submit" [disabled]="busy() || f.invalid">
              {{ busy() ? 'Creating…' : 'Create property' }}
            </button>
          </form>
        </section>
      }

      @if (loading()) {
        <div class="skeleton" style="height: 8rem"></div>
      } @else if (hotels().length === 0) {
        <div class="empty">
          <h3>No properties yet</h3>
          <p>Add one to start taking bookings.</p>
        </div>
      } @else {
        <ul class="list">
          @for (h of hotels(); track h.id) {
            <li class="card item">
              <div class="item__media">
                @if (h.coverImageUrl) {
                  <img [src]="h.coverImageUrl" [alt]="h.name" />
                } @else {
                  <span class="num">{{ h.name.charAt(0) }}</span>
                }
              </div>

              <div class="item__body">
                <div class="item__head">
                  <h2><a [routerLink]="['/manage', h.id]">{{ h.name }}</a></h2>
                  <app-stars [value]="h.stars" />
                </div>
                <p class="muted small">{{ h.address.city }}, {{ h.address.country }}</p>
                <p class="muted small">
                  @if (h.fromPrice !== null) {
                    from <span class="num">{{ money(h.fromPrice) }}</span> a night &middot;
                  }
                  {{ h.reviewCount }} review{{ h.reviewCount === 1 ? '' : 's' }}
                </p>
              </div>

              <div class="item__side">
                <a class="btn btn--sm" [routerLink]="['/manage', h.id]">Open</a>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: var(--s6) var(--s5) var(--s8);
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--s4);
        flex-wrap: wrap;
        margin-bottom: var(--s5);
      }

      .form {
        padding: var(--s5);
        margin-bottom: var(--s5);
      }

      .row {
        display: flex;
        gap: var(--s3);
        flex-wrap: wrap;
      }

      .row .field {
        flex: 1 1 10rem;
      }

      .row .narrow {
        flex: 0 1 6rem;
      }

      .amenities {
        border: 0;
        border-top: 1px solid var(--line);
        padding: var(--s3) 0 0;
        margin: 0 0 var(--s4);
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
        gap: var(--s1) var(--s4);
      }

      .amenities legend {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--ink-soft);
      }

      .check {
        display: flex;
        align-items: center;
        gap: var(--s2);
        font-size: 0.88rem;
      }

      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--s3);
      }

      .item {
        display: flex;
        align-items: center;
        gap: var(--s4);
        padding: var(--s3);
      }

      .item__media {
        flex: 0 0 5rem;
        height: 4rem;
        border-radius: var(--radius);
        background: var(--surface-sunk);
        display: grid;
        place-items: center;
        overflow: hidden;
        font-size: 1.6rem;
        color: var(--ink-faint);
      }

      .item__media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .item__body {
        flex: 1 1 auto;
        min-width: 0;
      }

      .item__head {
        display: flex;
        align-items: center;
        gap: var(--s3);
      }

      .item h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      .item h2 a {
        color: inherit;
        text-decoration: none;
      }

      .item h2 a:hover {
        text-decoration: underline;
      }

      .small {
        font-size: 0.85rem;
        margin: 0;
      }
    `,
  ],
})
export class ManageHotelsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toasts = inject(ToastService);

  protected readonly hotels = signal<HotelSummary[]>([]);
  protected readonly amenities = signal<Amenity[]>([]);
  protected readonly selected = signal(new Set<string>());
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly showForm = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  protected draft = {
    name: '',
    description: '',
    phone: '',
    email: '',
    stars: 3,
    addressLine: '',
    city: '',
    country: '',
  };

  ngOnInit(): void {
    this.load();

    this.api.amenities('Hotel').subscribe({
      next: (list) => this.amenities.set(list),
      error: () => undefined,
    });
  }

  private load(): void {
    this.loading.set(true);

    this.api.myHotels(1, 50).subscribe({
      next: (page) => {
        this.hotels.set(page.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.fromError(err, 'Could not load your properties.');
        this.loading.set(false);
      },
    });
  }

  protected toggle(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected create(): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.errors.set({});

    this.api
      .createHotel({ ...this.draft, amenityIds: [...this.selected()] })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.showForm.set(false);
          this.selected.set(new Set());
          this.draft = {
            name: '',
            description: '',
            phone: '',
            email: '',
            stars: 3,
            addressLine: '',
            city: '',
            country: '',
          };
          this.toasts.success('Property created. Add rooms next.');
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.errors.set(fieldErrors(err));
          this.toasts.fromError(err, 'Could not create the property.');
        },
      });
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
