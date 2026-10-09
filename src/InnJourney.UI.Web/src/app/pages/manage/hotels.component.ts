import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { formatPrice } from '../../core/dates';
import { Amenity, HotelSummary } from '../../core/models';
import { ToastService, fieldErrors } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { PlateComponent } from '../../shared/plate.component';
import { StarsComponent } from '../../shared/stars.component';

@Component({
  selector: 'app-manage-hotels',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PlateComponent, StarsComponent],
  template: `
    <div class="page wrap">
      <header class="page-head">
        <div>
          <h1>My properties</h1>
          <p class="muted">Rooms, rates, bookings and revenue for each place you run.</p>
        </div>

        <button class="btn btn--pill" type="button" (click)="showForm.set(!showForm())">
          <app-icon [name]="showForm() ? 'close' : 'plus'" [size]="16" [stroke]="2" />
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
        <ul class="grid-cards list">
          @for (h of hotels(); track h.id) {
            <li class="stay">
              <div class="stay__media">
                <app-plate [seed]="h.id" [src]="h.coverImageUrl" [label]="h.name" />
              </div>

              <div class="stay__body">
                <h2 class="stay__title"><a [routerLink]="['/manage', h.id]">{{ h.name }}</a></h2>
                <p class="stay__where">{{ h.address.city }}, {{ h.address.country }}</p>

                <div class="stay__foot">
                  <ul class="facts">
                    <li><app-stars [value]="h.stars" /></li>
                    <li>
                      <app-icon name="star" [size]="14" [filled]="true" [stroke]="1" class="rated" />
                      {{ h.reviewCount }} review{{ h.reviewCount === 1 ? '' : 's' }}
                    </li>
                  </ul>
                  @if (h.fromPrice !== null) {
                    <p class="price">
                      <span class="price__night">{{ money(h.fromPrice) }}<small>/night</small></span>
                    </p>
                  }
                </div>
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
        padding-bottom: var(--s8);
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
      }

      .price {
        margin: 0;
      }

      .rated {
        color: var(--star);
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
    return formatPrice(value);
  }
}
