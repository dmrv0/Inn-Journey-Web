import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { addDays, formatMoney, nightsBetween } from '../core/dates';
import { Amenity, HotelSummary, PagedResult } from '../core/models';
import { ToastService } from '../core/toast.service';
import { RibbonComponent } from '../shared/ribbon.component';
import { StarsComponent } from '../shared/stars.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, RouterLink, RibbonComponent, StarsComponent],
  template: `
    <div class="page layout">
      <aside class="filters" aria-label="Filters">
        <h2 class="filters__title">Refine</h2>

        <div class="field">
          <label for="f-city">City</label>
          <input id="f-city" class="input" [(ngModel)]="city" placeholder="Anywhere" />
        </div>

        <div class="row">
          <div class="field">
            <label for="f-in">Check in</label>
            <input id="f-in" class="input input--num" type="date" [(ngModel)]="checkIn" />
          </div>
          <div class="field">
            <label for="f-out">Check out</label>
            <input id="f-out" class="input input--num" type="date" [(ngModel)]="checkOut" />
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label for="f-guests">Guests</label>
            <input
              id="f-guests"
              class="input input--num"
              type="number"
              min="1"
              max="20"
              [(ngModel)]="guests"
            />
          </div>
          <div class="field">
            <label for="f-stars">Min stars</label>
            <select id="f-stars" class="input" [(ngModel)]="minStars">
              <option [ngValue]="null">Any</option>
              @for (s of [1, 2, 3, 4, 5]; track s) {
                <option [ngValue]="s">{{ s }}+</option>
              }
            </select>
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label for="f-min">Min price</label>
            <input id="f-min" class="input input--num" type="number" min="0" [(ngModel)]="minPrice" />
          </div>
          <div class="field">
            <label for="f-max">Max price</label>
            <input id="f-max" class="input input--num" type="number" min="0" [(ngModel)]="maxPrice" />
          </div>
        </div>

        @if (amenities().length) {
          <fieldset class="amenities">
            <legend>Facilities</legend>
            @for (a of amenities(); track a.id) {
              <label class="check">
                <input
                  type="checkbox"
                  [checked]="selectedAmenities().has(a.id)"
                  (change)="toggleAmenity(a.id)"
                />
                {{ a.name }}
              </label>
            }
          </fieldset>
        }

        <button class="btn" type="button" (click)="apply()">Apply</button>
        <button class="btn btn--ghost" type="button" (click)="reset()">Clear</button>
      </aside>

      <section class="results">
        <header class="results__head">
          <div>
            <h1 class="results__title">
              @if (loading()) {
                Searching&hellip;
              } @else {
                {{ total() }} {{ total() === 1 ? 'property' : 'properties' }}
              }
            </h1>
            @if (nights() > 0) {
              <p class="muted num">
                {{ nights() }} night{{ nights() === 1 ? '' : 's' }} &middot; {{ guests }} guest{{
                  guests === 1 ? '' : 's'
                }}
              </p>
            }
          </div>

          <div class="field field--inline">
            <label for="sort">Sort</label>
            <select id="sort" class="input" [(ngModel)]="sort" (ngModelChange)="apply()">
              <option value="">Best rated</option>
              <option value="price_asc">Price, low to high</option>
              <option value="price_desc">Price, high to low</option>
              <option value="stars_desc">Stars</option>
              <option value="name_asc">Name</option>
            </select>
          </div>
        </header>

        @if (loading()) {
          <div class="grid">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="card skeleton-card">
                <div class="skeleton" style="height: 9rem"></div>
                <div class="skeleton" style="height: 1.2rem; margin: 1rem"></div>
                <div class="skeleton" style="height: 0.9rem; margin: 0 1rem 1rem; width: 60%"></div>
              </div>
            }
          </div>
        } @else if (hotels().length === 0) {
          <div class="empty">
            <h3>Nothing matches those nights</h3>
            <p>Try a wider date range, fewer facilities, or a different city.</p>
            <button class="btn btn--ghost" type="button" (click)="reset()">Clear filters</button>
          </div>
        } @else {
          <div class="grid">
            @for (hotel of hotels(); track hotel.id) {
              <article class="card hotel">
                <a class="hotel__media" [routerLink]="['/hotels', hotel.id]">
                  @if (hotel.coverImageUrl) {
                    <img [src]="hotel.coverImageUrl" [alt]="hotel.name" loading="lazy" />
                  } @else {
                    <span class="hotel__placeholder num">{{ initials(hotel.name) }}</span>
                  }
                </a>

                <div class="hotel__body">
                  <div class="hotel__head">
                    <h3>
                      <a [routerLink]="['/hotels', hotel.id]">{{ hotel.name }}</a>
                    </h3>
                    <app-stars [value]="hotel.stars" />
                  </div>

                  <p class="hotel__where muted">
                    {{ hotel.address.city }}, {{ hotel.address.country }}
                  </p>

                  @if (hotel.reviewCount > 0) {
                    <p class="rating">
                      <span class="rating__score num">{{ hotel.averageRating.toFixed(1) }}</span>
                      <span class="muted">from {{ hotel.reviewCount }} review{{ hotel.reviewCount === 1 ? '' : 's' }}</span>
                    </p>
                  } @else {
                    <p class="muted small">No reviews yet</p>
                  }

                  @if (appliedSpan(); as span) {
                    <app-ribbon
                      class="hotel__ribbon"
                      [from]="span.from"
                      [to]="span.to"
                      [compact]="true"
                      [showScale]="false"
                      [selectedFrom]="span.from"
                      [selectedTo]="span.to"
                    />
                  }

                  <div class="hotel__foot">
                    @if (hotel.fromPrice !== null) {
                      <span class="price">
                        <span class="num">{{ money(hotel.fromPrice) }}</span>
                        <span class="muted small">per night</span>
                      </span>
                    }
                    <a class="btn btn--sm" [routerLink]="['/hotels', hotel.id]" [queryParams]="spanParams()">
                      See rooms
                    </a>
                  </div>
                </div>
              </article>
            }
          </div>

          @if (totalPages() > 1) {
            <nav class="pager" aria-label="Pagination">
              <button class="btn btn--ghost btn--sm" [disabled]="page() <= 1" (click)="goTo(page() - 1)">
                Previous
              </button>
              <span class="num">Page {{ page() }} of {{ totalPages() }}</span>
              <button
                class="btn btn--ghost btn--sm"
                [disabled]="page() >= totalPages()"
                (click)="goTo(page() + 1)"
              >
                Next
              </button>
            </nav>
          }
        }
      </section>
    </div>
  `,
  styles: [
    `
      .layout {
        display: grid;
        grid-template-columns: 16rem 1fr;
        gap: var(--s6);
        padding-top: var(--s6);
        align-items: start;
      }

      @media (max-width: 860px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }

      .filters {
        position: sticky;
        top: 5rem;
        padding: var(--s4);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
      }

      .filters__title {
        font-size: 0.8rem;
        font-family: var(--mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-faint);
        margin-bottom: var(--s4);
      }

      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s3);
      }

      .amenities {
        border: 0;
        border-top: 1px solid var(--line);
        padding: var(--s3) 0 0;
        margin: 0 0 var(--s4);
      }

      .amenities legend {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--ink-soft);
        padding: 0 var(--s2) 0 0;
      }

      .check {
        display: flex;
        align-items: center;
        gap: var(--s2);
        font-size: 0.88rem;
        padding: 0.15rem 0;
      }

      .filters .btn {
        width: 100%;
        margin-top: var(--s2);
      }

      .results__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--s4);
        flex-wrap: wrap;
        margin-bottom: var(--s5);
      }

      .results__title {
        font-size: 1.6rem;
        margin: 0;
      }

      .field--inline {
        margin: 0;
        min-width: 12rem;
      }

      .grid {
        display: grid;
        gap: var(--s4);
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
      }

      .hotel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .hotel__media {
        display: block;
        aspect-ratio: 16 / 10;
        background: var(--surface-sunk);
        display: grid;
        place-items: center;
      }

      .hotel__media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .hotel__placeholder {
        font-size: 2rem;
        font-weight: 600;
        color: var(--ink-faint);
        letter-spacing: 0.1em;
      }

      .hotel__body {
        padding: var(--s4);
        display: flex;
        flex-direction: column;
        gap: var(--s2);
        flex: 1 0 auto;
      }

      .hotel__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--s2);
      }

      .hotel__head h3 {
        margin: 0;
        font-size: 1.05rem;
      }

      .hotel__head a {
        color: inherit;
        text-decoration: none;
      }

      .hotel__head a:hover {
        text-decoration: underline;
      }

      .hotel__where,
      .small {
        font-size: 0.85rem;
        margin: 0;
      }

      .rating {
        display: flex;
        align-items: baseline;
        gap: var(--s2);
        margin: 0;
        font-size: 0.85rem;
      }

      .rating__score {
        font-weight: 600;
        color: var(--pool);
        font-size: 1rem;
      }

      .hotel__ribbon {
        margin: var(--s2) 0;
      }

      .hotel__foot {
        margin-top: auto;
        padding-top: var(--s3);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s3);
        border-top: 1px solid var(--line);
      }

      .price {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .price .num {
        font-size: 1.05rem;
        font-weight: 600;
      }

      .pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s4);
        margin-top: var(--s6);
        font-size: 0.85rem;
      }

      .skeleton-card {
        overflow: hidden;
      }
    `,
  ],
})
export class SearchComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected city = '';
  protected checkIn = '';
  protected checkOut = '';
  protected guests = 2;
  protected minStars: number | null = null;
  protected minPrice: number | null = null;
  protected maxPrice: number | null = null;
  protected sort = '';

  protected readonly selectedAmenities = signal(new Set<string>());
  protected readonly amenities = signal<Amenity[]>([]);
  protected readonly hotels = signal<HotelSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly page = signal(1);

  /** The span actually used for the current results, for the card ribbons. */
  protected readonly appliedSpan = signal<{ from: string; to: string } | null>(null);

  protected readonly nights = computed(() => {
    const span = this.appliedSpan();
    return span ? nightsBetween(span.from, span.to) : 0;
  });

  ngOnInit(): void {
    this.api.amenities('Hotel').subscribe({
      next: (list) => this.amenities.set(list),
      error: () => undefined,
    });

    this.route.queryParamMap.subscribe((params) => {
      this.city = params.get('city') ?? '';
      this.checkIn = params.get('checkIn') ?? '';
      this.checkOut = params.get('checkOut') ?? '';
      this.guests = Number(params.get('guests') ?? 2);
      this.minStars = params.get('minStars') ? Number(params.get('minStars')) : null;
      this.minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
      this.maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
      this.sort = params.get('sort') ?? '';
      this.page.set(Number(params.get('page') ?? 1));
      this.selectedAmenities.set(new Set(params.getAll('amenityIds')));

      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);

    const hasSpan = Boolean(this.checkIn && this.checkOut && this.checkOut > this.checkIn);

    this.api
      .searchHotels({
        query: undefined,
        city: this.city || undefined,
        checkIn: hasSpan ? this.checkIn : undefined,
        checkOut: hasSpan ? this.checkOut : undefined,
        guests: this.guests,
        minStars: this.minStars ?? undefined,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        amenityIds: [...this.selectedAmenities()],
        sort: this.sort || undefined,
        page: this.page(),
        pageSize: 12,
      })
      .subscribe({
        next: (result: PagedResult<HotelSummary>) => {
          this.hotels.set(result.items);
          this.total.set(result.totalCount);
          this.totalPages.set(Math.max(result.totalPages, 1));
          this.appliedSpan.set(hasSpan ? { from: this.checkIn, to: this.checkOut } : null);
          this.loading.set(false);
        },
        error: (err) => {
          this.toasts.fromError(err, 'Could not load properties.');
          this.hotels.set([]);
          this.loading.set(false);
        },
      });
  }

  protected toggleAmenity(id: string): void {
    this.selectedAmenities.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected apply(page = 1): void {
    if (this.checkIn && this.checkOut && this.checkOut <= this.checkIn) {
      this.checkOut = addDays(this.checkIn, 1);
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        city: this.city || null,
        checkIn: this.checkIn || null,
        checkOut: this.checkOut || null,
        guests: this.guests,
        minStars: this.minStars,
        minPrice: this.minPrice,
        maxPrice: this.maxPrice,
        sort: this.sort || null,
        amenityIds: [...this.selectedAmenities()],
        page,
      },
    });
  }

  protected goTo(page: number): void {
    this.apply(page);
  }

  protected reset(): void {
    this.city = '';
    this.checkIn = '';
    this.checkOut = '';
    this.guests = 2;
    this.minStars = null;
    this.minPrice = null;
    this.maxPrice = null;
    this.sort = '';
    this.selectedAmenities.set(new Set());
    this.apply();
  }

  protected spanParams(): Record<string, string> {
    const span = this.appliedSpan();
    if (!span) return {};

    return { checkIn: span.from, checkOut: span.to, guests: String(this.guests) };
  }

  protected money(value: number | null): string {
    return formatMoney(value);
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
