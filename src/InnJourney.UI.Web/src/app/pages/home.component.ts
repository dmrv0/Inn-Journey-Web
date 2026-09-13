import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { addDays, formatMoney, nightsBetween, today } from '../core/dates';
import { HotelSummary } from '../core/models';
import { PlateComponent } from '../shared/plate.component';
import { RibbonComponent } from '../shared/ribbon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink, RibbonComponent, PlateComponent],
  template: `
    <section class="hero">
      <div class="hero__texture" aria-hidden="true">
        <app-ribbon
          [from]="ribbonFrom"
          [to]="ribbonTo"
          [occupied]="demoOccupied"
          [showScale]="false"
          [compact]="true"
          tone="dark"
        />
      </div>

      <div class="page--wide hero__inner">
        <p class="pill pill--night hero__badge">
          <span class="hero__dot" aria-hidden="true"></span>
          Availability priced by the night
        </p>

        <h1 class="hero__title">
          Tell us the nights.<br />
          We&rsquo;ll show you what&rsquo;s <span class="lit">still lit</span>.
        </h1>

        <p class="hero__lede">
          A stay is a span, not a date. Every room is checked across the whole span you
          need it &mdash; so a room free on the day the last guest leaves shows as free.
        </p>

        <form class="hunt" (ngSubmit)="search()">
          <div class="hunt__seg">
            <label for="where">Where to?</label>
            <input
              id="where"
              name="where"
              [(ngModel)]="city"
              placeholder="Search destinations"
              autocomplete="off"
            />
          </div>

          <div class="hunt__seg">
            <label for="from">Check in</label>
            <input
              id="from"
              class="num"
              type="date"
              name="from"
              [min]="minDate"
              [(ngModel)]="checkIn"
              (ngModelChange)="onCheckInChange()"
            />
          </div>

          <div class="hunt__seg">
            <label for="to">Check out</label>
            <input
              id="to"
              class="num"
              type="date"
              name="to"
              [min]="minCheckOut()"
              [(ngModel)]="checkOut"
              (ngModelChange)="recount()"
            />
          </div>

          <div class="hunt__seg hunt__seg--narrow">
            <label for="guests">Guests</label>
            <input
              id="guests"
              class="num"
              type="number"
              name="guests"
              min="1"
              max="20"
              [(ngModel)]="guests"
            />
          </div>

          <button class="hunt__go" type="submit">Search</button>
        </form>

        <p class="hero__count num" aria-live="polite">
          @if (nights() > 0) {
            {{ nights() }} night{{ nights() === 1 ? '' : 's' }} &middot; {{ guests }}
            guest{{ guests === 1 ? '' : 's' }}
          } @else {
            Check-out must be after check-in
          }
        </p>
      </div>
    </section>

    @if (featured().length > 0) {
      <section class="page--wide band">
        <div class="section-head">
          <p class="eyebrow">Available now</p>
          <h2>Places with nights free</h2>
          <p>Each plate frames the month around your dates, with the nights you asked for
            marked out.</p>
        </div>

        <div class="grid-cards">
          @for (hotel of featured(); track hotel.id) {
            <article class="card card--stack">
              <a [routerLink]="['/hotels', hotel.id]" class="plate-link">
                <app-plate
                  [seed]="hotel.id"
                  [src]="hotel.coverImageUrl"
                  [alt]="hotel.name"
                  [label]="hotel.name"
                  [from]="window().from"
                  [to]="window().to"
                  [selectedFrom]="window().selectedFrom"
                  [selectedTo]="window().selectedTo"
                >
                  <span class="chip">{{ hotel.stars }}&#9733;</span>
                  @if (hotel.reviewCount > 0) {
                    <span class="chip">{{ hotel.averageRating.toFixed(1) }} rated</span>
                  }
                </app-plate>
              </a>

              <div class="card__body">
                <h3 class="card__title">
                  <a [routerLink]="['/hotels', hotel.id]">{{ hotel.name }}</a>
                </h3>
                <p class="where">
                  <span class="where__pin" aria-hidden="true"></span>
                  {{ hotel.address.city }}, {{ hotel.address.country }}
                </p>
              </div>

              @if (hotel.fromPrice !== null) {
                <div class="price-row">
                  <span class="price-row__amount">{{ money(hotel.fromPrice) }}</span>
                  <span class="price-row__unit">per night</span>

                  @if (nights() > 0) {
                    <span class="price-row__span num">
                      {{ money(hotel.fromPrice * nights()) }} for
                      {{ nights() }} night{{ nights() === 1 ? '' : 's' }}
                    </span>
                  }
                </div>
              }
            </article>
          }
        </div>
      </section>

      @if (cities().length > 1) {
        <section class="page--wide band">
          <div class="section-head">
            <p class="eyebrow">By city</p>
            <h2>Where the rooms are</h2>
          </div>

          <div class="cities">
            @for (city of cities(); track city) {
              <a class="city" [routerLink]="['/search']" [queryParams]="{ city: city }">
                <app-plate [seed]="city" [label]="city" />
                <span class="city__name">{{ city }}</span>
              </a>
            }
          </div>
        </section>
      }
    }

    <section class="page band">
      <div class="section-head">
        <p class="eyebrow">How it works</p>
        <h2>Three steps, and the room is held</h2>
      </div>

      <ol class="steps">
        <li>
          <span class="steps__n num">01</span>
          <h3>Pick your nights</h3>
          <p>
            Availability is worked out for the whole span at once, so what you see is
            bookable.
          </p>
        </li>
        <li>
          <span class="steps__n num">02</span>
          <h3>Choose a room</h3>
          <p>
            Prices are per night, per guest, with children charged at the room&rsquo;s child
            rate.
          </p>
        </li>
        <li>
          <span class="steps__n num">03</span>
          <h3>Pay to confirm</h3>
          <p>
            The room is held while you pay. Payments here are simulated &mdash; no card is
            ever charged or stored.
          </p>
        </li>
      </ol>

      <p class="center">
        <a routerLink="/search" class="btn btn--pill">Browse every property</a>
      </p>
    </section>
  `,
  styles: [
    `
      /* --- Hero -------------------------------------------------------------
         Full bleed, and pulled up under the floating nav so the ground runs
         behind it. The texture band is the product's own thesis used as the
         image a travel site would fill with a photograph. */

      .hero {
        position: relative;
        margin-top: calc(var(--nav-h) * -1);
        padding: calc(var(--nav-h) + var(--s8)) 0 var(--s7);
        overflow: hidden;
        background:
          radial-gradient(80% 60% at 12% 4%, #2e6e7350 0%, transparent 60%),
          radial-gradient(70% 70% at 92% 96%, #17414a80 0%, transparent 62%),
          linear-gradient(155deg, #081a22 0%, #123b40 58%, #16302c 100%);
        color: var(--on-night);
      }

      /* An occupancy rule along the hero's bottom edge: the product's own
         subject, running edge to edge, where a travel site would crop a photo. */
      .hero__texture {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        opacity: 0.55;
        pointer-events: none;
      }

      .hero__inner {
        position: relative;
      }

      .hero__badge {
        margin: 0 0 var(--s5);
      }

      .hero__dot {
        width: 0.4rem;
        height: 0.4rem;
        border-radius: 50%;
        background: var(--lamp);
        display: inline-block;
      }

      .hero__title {
        color: var(--on-night);
        font-size: clamp(2.4rem, 1.4rem + 4.2vw, 4.4rem);
        letter-spacing: -0.035em;
        line-height: 1.04;
        max-width: 16ch;
        margin: 0 0 var(--s4);
      }

      .lit {
        color: var(--lamp);
        white-space: nowrap;
      }

      .hero__lede {
        max-width: 46ch;
        font-size: 1.04rem;
        color: var(--on-night-soft);
        margin: 0 0 var(--s6);
      }

      /* --- The search bar ---------------------------------------------------
         One white bar, divided rather than boxed: the fields belong to a single
         question, so they share a surface instead of each carrying a border. */

      .hunt {
        display: flex;
        align-items: stretch;
        gap: 0;
        background: var(--surface);
        border-radius: var(--radius-pill);
        padding: 0.45rem 0.45rem 0.45rem 0.4rem;
        box-shadow: 0 18px 40px -20px rgb(0 0 0 / 55%);
        max-width: 58rem;
        flex-wrap: wrap;
      }

      .hunt__seg {
        flex: 1 1 11rem;
        min-width: 9rem;
        padding: 0.35rem 1.1rem;
        border-right: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .hunt__seg--narrow {
        flex: 0 1 7.5rem;
        min-width: 6.5rem;
      }

      .hunt__seg label {
        font-family: var(--mono);
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-faint);
        margin-bottom: 0.1rem;
      }

      .hunt__seg input {
        border: 0;
        padding: 0;
        background: transparent;
        font-size: 0.95rem;
        color: var(--ink);
        width: 100%;
        min-width: 0;
      }

      .hunt__seg input:focus {
        outline: none;
      }

      .hunt__seg:focus-within {
        background: var(--pool-soft);
        border-radius: var(--radius);
      }

      .hunt__seg input::placeholder {
        color: var(--ink-faint);
      }

      .hunt__go {
        flex: 0 0 auto;
        border: 0;
        border-radius: var(--radius-pill);
        background: var(--night);
        color: var(--on-night);
        font-weight: 600;
        font-size: 0.95rem;
        padding: 0.8rem 2rem;
        cursor: pointer;
        transition: background 120ms ease;
      }

      .hunt__go:hover {
        background: var(--pool);
      }

      .hero__count {
        margin: var(--s4) 0 0;
        font-size: 0.8rem;
        color: var(--on-night-soft);
      }

      /* --- Bands ------------------------------------------------------------ */

      .band {
        padding-top: var(--s8);
      }

      .plate-link {
        display: block;
      }

      /* What the chosen span costs at this property's lowest nightly rate. */
      .price-row__span {
        margin-left: auto;
        font-size: 0.78rem;
        color: var(--ink-faint);
      }

      /* --- Cities ----------------------------------------------------------- */

      .cities {
        display: grid;
        gap: var(--s4);
        grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      }

      .city {
        position: relative;
        display: block;
        border-radius: var(--radius-lg);
        overflow: hidden;
        text-decoration: none;
        box-shadow: var(--shadow);
        transition: transform 140ms ease;
      }

      .city:hover {
        transform: translateY(-3px);
      }

      .city__name {
        position: absolute;
        left: var(--s4);
        bottom: var(--s4);
        font-family: var(--display);
        font-weight: 700;
        font-size: 1.1rem;
        color: #fff;
        text-shadow: 0 1px 12px rgb(0 0 0 / 60%);
      }

      /* --- Steps ------------------------------------------------------------ */

      .steps {
        list-style: none;
        padding: 0;
        margin: 0 0 var(--s6);
        display: grid;
        gap: var(--s5);
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      }

      .steps li {
        border-top: 2px solid var(--line);
        padding-top: var(--s3);
      }

      /* Numbered because booking genuinely is a sequence. */
      .steps__n {
        color: var(--pool);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .steps h3 {
        margin: var(--s2) 0 var(--s1);
      }

      .steps p {
        font-size: 0.9rem;
        margin: 0;
        color: var(--ink-soft);
      }

      @media (max-width: 760px) {
        .hunt {
          border-radius: var(--radius-xl);
        }

        .hunt__seg {
          flex: 1 1 100%;
          border-right: 0;
          border-bottom: 1px solid var(--line);
          padding: 0.55rem 0.9rem;
        }

        .hunt__go {
          width: 100%;
          margin-top: 0.45rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .city:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly minDate = today();

  protected city = '';
  protected checkIn = addDays(today(), 14);
  protected checkOut = addDays(today(), 17);
  protected guests = 2;

  /** The hero ribbon is illustrative: a month, with a plausible pattern of stays. */
  protected readonly ribbonFrom = addDays(today(), 7);
  protected readonly ribbonTo = addDays(today(), 35);
  protected readonly demoOccupied = [
    ...[0, 1, 2].map((d) => addDays(this.ribbonFrom, d)),
    ...[5, 6, 7, 8].map((d) => addDays(this.ribbonFrom, d)),
    ...[12, 13].map((d) => addDays(this.ribbonFrom, d)),
    ...[19, 20, 21, 22, 23].map((d) => addDays(this.ribbonFrom, d)),
  ];

  protected readonly nights = signal(3);

  /** The month the card ribbons draw, always framing the current selection. */
  protected readonly window = signal(this.frame());
  protected readonly featured = signal<HotelSummary[]>([]);

  /** Cities the catalogue actually covers, rather than a list written by hand. */
  protected readonly cities = computed(() => [
    ...new Set(this.featured().map((h) => h.address.city)),
  ]);

  ngOnInit(): void {
    // The landing page is useful without this, so a failure here stays quiet and
    // the section simply does not render.
    this.api.searchHotels({ page: 1, pageSize: 8 }).subscribe({
      next: (result) => this.featured.set(result.items),
      error: () => this.featured.set([]),
    });
  }

  protected money(value: number): string {
    return formatMoney(value);
  }

  protected minCheckOut(): string {
    return addDays(this.checkIn, 1);
  }

  protected onCheckInChange(): void {
    // Keep the span valid rather than letting the user submit something the API
    // will only reject.
    if (this.checkOut <= this.checkIn) {
      this.checkOut = addDays(this.checkIn, 1);
    }

    this.recount();
  }

  protected recount(): void {
    this.nights.set(nightsBetween(this.checkIn, this.checkOut));
    this.window.set(this.frame());
  }

  private frame(): { from: string; to: string; selectedFrom: string; selectedTo: string } {
    return {
      from: addDays(this.checkIn, -4),
      to: addDays(this.checkIn, 24),
      selectedFrom: this.checkIn,
      selectedTo: this.checkOut,
    };
  }

  protected search(): void {
    this.recount();

    if (this.nights() < 1) return;

    void this.router.navigate(['/search'], {
      queryParams: {
        city: this.city || null,
        checkIn: this.checkIn,
        checkOut: this.checkOut,
        guests: this.guests,
      },
    });
  }
}
