import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiService } from '../core/api.service';
import { addDays, nightsBetween } from '../core/dates';
import { Amenity, HotelSummary, PagedResult } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent, amenityIcon } from '../shared/icon.component';
import { SearchBarComponent, StaySearch } from '../shared/search-bar.component';
import { StayCardComponent } from '../shared/stay-card.component';

type PageMark = number | 'gap';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, IconComponent, SearchBarComponent, StayCardComponent],
  template: `
    <div class="band">
      <div class="page--wide band__inner">
        <app-search-bar [initial]="barStart()" cta="Update search" (searched)="research($event)" />
      </div>
    </div>

    <div class="page--wide">
      <header class="results-head">
        <h1 class="results-head__title" aria-live="polite">
          @if (loading()) {
            Searching&hellip;
          } @else {
            Found {{ total() }} {{ total() === 1 ? 'stay' : 'stays' }}
            @if (city) {
              in <strong>{{ city }}</strong>
            }
            @if (nights() > 0) {
              <span class="results-head__span">
                for {{ nights() }} night{{ nights() === 1 ? '' : 's' }}
              </span>
            }
          }
        </h1>

        <div class="results-head__tools">
          <label class="sort">
            <app-icon name="sort" [size]="16" />
            <span class="visually-hidden">Sort by</span>
            <select [(ngModel)]="sort" (ngModelChange)="apply()">
              <option value="">Best rated</option>
              <option value="price_asc">Lowest price</option>
              <option value="price_desc">Highest price</option>
              <option value="stars_desc">Most stars</option>
              <option value="name_asc">Name</option>
            </select>
            <app-icon name="chevron-down" [size]="16" />
          </label>

          <button
            type="button"
            class="filters-toggle"
            [attr.aria-expanded]="filtersOpen()"
            aria-controls="filters"
            (click)="filtersOpen.set(!filtersOpen())"
          >
            <app-icon name="sliders" [size]="16" />
            Filters
            @if (activeFilters() > 0) {
              ({{ activeFilters() }})
            }
          </button>
        </div>
      </header>

      @if (amenities().length) {
        <div class="chip-row" role="group" aria-label="Facilities">
          <button
            type="button"
            class="filter-chip"
            [class.is-on]="selectedAmenities().size === 0"
            (click)="clearAmenities()"
          >
            Any
          </button>
          @for (a of amenities(); track a.id) {
            <button
              type="button"
              class="filter-chip"
              [class.is-on]="selectedAmenities().has(a.id)"
              [attr.aria-pressed]="selectedAmenities().has(a.id)"
              (click)="toggleAmenity(a.id)"
            >
              <app-icon [name]="icon(a.name)" [size]="17" />
              {{ a.name }}
            </button>
          }
        </div>
      }

      <div class="layout">
        <section class="results" aria-label="Results">
          @if (loading()) {
            <div class="grid">
              @for (i of [1, 2, 3, 4]; track i) {
                <div class="stay">
                  <div class="skeleton" style="aspect-ratio: 16 / 10.5"></div>
                  <div class="skeleton" style="height: 1.1rem; margin: 1rem 0.4rem 0.5rem; width: 60%"></div>
                  <div class="skeleton" style="height: 0.9rem; margin: 0 0.4rem 0.6rem; width: 80%"></div>
                </div>
              }
            </div>
          } @else if (hotels().length === 0) {
            <div class="empty">
              <h3>Nothing matches those nights</h3>
              <p>Try a wider date range, fewer facilities, or a different city.</p>
              <button class="btn btn--ghost" type="button" (click)="reset()">Clear all filters</button>
            </div>
          } @else {
            <div class="grid">
              @for (hotel of hotels(); track hotel.id) {
                <app-stay-card
                  [hotel]="hotel"
                  [nights]="nights()"
                  [window]="plateWindow()"
                  [params]="spanParams()"
                />
              }
            </div>

            @if (totalPages() > 1) {
              <nav class="pager" aria-label="Pages">
                <button
                  type="button"
                  class="pager__step"
                  [disabled]="page() <= 1"
                  (click)="apply(page() - 1)"
                >
                  <app-icon name="chevron-left" [size]="16" />
                  <span class="visually-hidden">Previous page</span>
                </button>

                @for (mark of pageMarks(); track $index) {
                  @if (mark === 'gap') {
                    <span class="pager__gap" aria-hidden="true">&hellip;</span>
                  } @else {
                    <button
                      type="button"
                      class="pager__n"
                      [class.is-on]="mark === page()"
                      [attr.aria-current]="mark === page() ? 'page' : null"
                      (click)="apply(mark)"
                    >
                      {{ mark }}
                    </button>
                  }
                }

                <button
                  type="button"
                  class="pager__step"
                  [disabled]="page() >= totalPages()"
                  (click)="apply(page() + 1)"
                >
                  <app-icon name="chevron-right" [size]="16" />
                  <span class="visually-hidden">Next page</span>
                </button>
              </nav>
            }
          }
        </section>

        <aside id="filters" class="filters" [class.is-open]="filtersOpen()" aria-label="Filters">
          <div class="filters__head">
            <h2>Filters</h2>
            @if (activeFilters() > 0) {
              <button type="button" class="linklike" (click)="reset()">
                Clear all ({{ activeFilters() }})
              </button>
            }
          </div>

          <form class="filters__group" (ngSubmit)="apply()">
            <h3>Price per night</h3>
            <div class="price-pair">
              <div class="field">
                <label for="f-min">Minimum</label>
                <input id="f-min" name="min" class="input input--num" type="number" min="0" placeholder="0" [(ngModel)]="minPrice" />
              </div>
              <div class="field">
                <label for="f-max">Maximum</label>
                <input id="f-max" name="max" class="input input--num" type="number" min="0" placeholder="Any" [(ngModel)]="maxPrice" />
              </div>
            </div>
            <button class="btn btn--soft btn--sm btn--block" type="submit">Apply price</button>
          </form>

          <div class="filters__group">
            <h3 id="stars-label">Hotel class</h3>
            <div class="choices" role="group" aria-labelledby="stars-label">
              <button type="button" class="choice" [class.is-on]="minStars === null" (click)="setStars(null)">Any</button>
              @for (s of [3, 4, 5]; track s) {
                <button type="button" class="choice" [class.is-on]="minStars === s" (click)="setStars(s)">
                  {{ s }}+
                </button>
              }
            </div>
          </div>

          <div class="filters__group">
            <h3 id="rating-label">Guest rating</h3>
            <div class="choices" role="group" aria-labelledby="rating-label">
              <button type="button" class="choice" [class.is-on]="minRating === null" (click)="setRating(null)">Any</button>
              @for (r of [3, 4, 4.5]; track r) {
                <button type="button" class="choice" [class.is-on]="minRating === r" (click)="setRating(r)">
                  {{ r }}+
                </button>
              }
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      .band__inner {
        padding-top: var(--s6);
        padding-bottom: var(--s6);
      }

      .results-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s4);
        flex-wrap: wrap;
        padding: var(--s6) 0 var(--s4);
        border-bottom: 1px solid var(--line);
      }

      .results-head__title {
        font-size: clamp(1.15rem, 1rem + 0.6vw, 1.4rem);
        font-weight: 400;
        letter-spacing: -0.01em;
        margin: 0;
      }

      .results-head__title strong {
        font-weight: 600;
      }

      .results-head__span {
        color: var(--ink-soft);
      }

      .results-head__tools {
        display: flex;
        gap: var(--s2);
      }

      .sort,
      .filters-toggle {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        height: 2.6rem;
        padding: 0 0.95rem;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-pill);
        background: var(--surface);
        color: var(--ink);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
      }

      .sort:focus-within {
        border-color: var(--pool);
      }

      .sort select {
        appearance: none;
        border: 0;
        background: transparent;
        font-weight: 500;
        cursor: pointer;
        padding-right: 0.2rem;
      }

      .sort select:focus {
        outline: none;
      }

      .filters-toggle {
        display: none;
      }

      .chip-row {
        display: flex;
        gap: var(--s2);
        overflow-x: auto;
        padding: var(--s4) 0;
        scrollbar-width: none;
      }

      .chip-row::-webkit-scrollbar {
        display: none;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 20rem;
        gap: var(--s5);
        align-items: start;
        padding-top: var(--s2);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
        gap: var(--s5);
      }

      /* --- Filters ------------------------------------------------------------ */

      .filters {
        position: sticky;
        top: calc(var(--nav-h) + var(--s4));
        padding: var(--s5);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
      }

      .filters__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--s3);
        padding-bottom: var(--s4);
        border-bottom: 1px solid var(--line);
      }

      .filters__head h2 {
        font-size: 1.1rem;
        margin: 0;
      }

      .filters__group {
        padding: var(--s5) 0;
        border-bottom: 1px solid var(--line);
      }

      .filters__group:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }

      .filters__group h3 {
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: var(--s3);
      }

      .price-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s3);
      }

      .price-pair .field {
        margin-bottom: var(--s3);
      }

      .linklike {
        background: none;
        border: 0;
        padding: 0;
        color: var(--ink);
        font-size: 0.88rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      /* --- Pager -------------------------------------------------------------- */

      .pager {
        display: flex;
        align-items: center;
        gap: var(--s1);
        margin-top: var(--s6);
        flex-wrap: wrap;
      }

      .pager__n,
      .pager__step {
        min-width: 2.4rem;
        height: 2.4rem;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--ink);
        font-size: 0.9rem;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .pager__n:hover,
      .pager__step:hover:not(:disabled) {
        background: var(--band);
      }

      .pager__n.is-on {
        background: var(--surface-sunk);
        font-weight: 600;
      }

      .pager__step:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .pager__gap {
        min-width: 2rem;
        text-align: center;
        color: var(--ink-faint);
      }

      @media (max-width: 960px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .filters-toggle {
          display: inline-flex;
        }

        .filters {
          display: none;
          position: static;
          order: -1;
        }

        .filters.is-open {
          display: block;
        }
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
  protected minRating: number | null = null;
  protected minPrice: number | null = null;
  protected maxPrice: number | null = null;
  protected sort = '';

  protected readonly icon = amenityIcon;

  protected readonly selectedAmenities = signal(new Set<string>());
  protected readonly amenities = signal<Amenity[]>([]);
  protected readonly hotels = signal<HotelSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly page = signal(1);
  protected readonly filtersOpen = signal(false);
  protected readonly activeFilters = signal(0);

  /** What the search bar shows: the question the current results answer. */
  protected readonly barStart = signal<Partial<StaySearch>>({});

  /** The span actually used for the current results, for the card ribbons. */
  protected readonly appliedSpan = signal<{ from: string; to: string } | null>(null);

  protected readonly nights = computed(() => {
    const span = this.appliedSpan();
    return span ? nightsBetween(span.from, span.to) : 0;
  });

  /**
   * The month a card plate draws. The span on its own would be three or four
   * cells stretched across the plate; framed by the weeks around it, the same
   * stay reads as a stay.
   */
  protected readonly plateWindow = computed(() => {
    const span = this.appliedSpan();

    if (span === null) return null;

    return {
      from: addDays(span.from, -4),
      to: addDays(span.from, 24),
      selectedFrom: span.from,
      selectedTo: span.to,
    };
  });

  /** Page numbers to show: the ends, and two either side of the current page. */
  protected readonly pageMarks = computed<PageMark[]>(() => {
    const last = this.totalPages();
    const current = this.page();
    const marks: PageMark[] = [];

    for (let n = 1; n <= last; n++) {
      if (n === 1 || n === last || Math.abs(n - current) <= 1) {
        marks.push(n);
      } else if (marks[marks.length - 1] !== 'gap') {
        marks.push('gap');
      }
    }

    return marks;
  });

  ngOnInit(): void {
    this.api.amenities('Hotel').subscribe({
      next: (list) => this.amenities.set(list),
      error: () => undefined,
    });

    this.route.queryParamMap.subscribe((params) => {
      const number = (key: string) => (params.get(key) ? Number(params.get(key)) : null);

      this.city = params.get('city') ?? '';
      this.checkIn = params.get('checkIn') ?? '';
      this.checkOut = params.get('checkOut') ?? '';
      this.guests = Number(params.get('guests') ?? 2);
      this.minStars = number('minStars');
      this.minRating = number('minRating');
      this.minPrice = number('minPrice');
      this.maxPrice = number('maxPrice');
      this.sort = params.get('sort') ?? '';
      this.page.set(Number(params.get('page') ?? 1));
      this.selectedAmenities.set(new Set(params.getAll('amenityIds')));

      this.activeFilters.set(
        [this.minStars, this.minRating, this.minPrice, this.maxPrice].filter((v) => v !== null)
          .length + this.selectedAmenities().size
      );

      this.barStart.set({
        city: this.city,
        checkIn: this.checkIn,
        checkOut: this.checkOut,
        guests: this.guests,
      });

      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);

    const hasSpan = Boolean(this.checkIn && this.checkOut && this.checkOut > this.checkIn);

    this.api
      .searchHotels({
        city: this.city || undefined,
        checkIn: hasSpan ? this.checkIn : undefined,
        checkOut: hasSpan ? this.checkOut : undefined,
        guests: this.guests,
        minStars: this.minStars ?? undefined,
        minRating: this.minRating ?? undefined,
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

  protected research(query: StaySearch): void {
    this.city = query.city;
    this.checkIn = query.checkIn;
    this.checkOut = query.checkOut;
    this.guests = query.guests;
    this.apply();
  }

  protected toggleAmenity(id: string): void {
    this.selectedAmenities.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    this.apply();
  }

  protected clearAmenities(): void {
    this.selectedAmenities.set(new Set());
    this.apply();
  }

  protected setStars(value: number | null): void {
    this.minStars = value;
    this.apply();
  }

  protected setRating(value: number | null): void {
    this.minRating = value;
    this.apply();
  }

  protected apply(page = 1): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        city: this.city || null,
        checkIn: this.checkIn || null,
        checkOut: this.checkOut || null,
        guests: this.guests,
        minStars: this.minStars,
        minRating: this.minRating,
        minPrice: this.minPrice,
        maxPrice: this.maxPrice,
        sort: this.sort || null,
        amenityIds: [...this.selectedAmenities()],
        page,
      },
    });
  }

  protected reset(): void {
    this.minStars = null;
    this.minRating = null;
    this.minPrice = null;
    this.maxPrice = null;
    this.selectedAmenities.set(new Set());
    this.apply();
  }

  protected spanParams(): Record<string, string> {
    const span = this.appliedSpan();
    if (!span) return {};

    return { checkIn: span.from, checkOut: span.to, guests: String(this.guests) };
  }
}
