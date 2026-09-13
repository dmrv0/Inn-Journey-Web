import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { addDays, nightsBetween, today } from '../core/dates';
import { RibbonComponent } from '../shared/ribbon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink, RibbonComponent],
  template: `
    <section class="hero">
      <div class="page hero__inner">
        <p class="eyebrow">Rooms, by the night</p>

        <h1 class="hero__title">
          Tell us the nights.<br />
          We&rsquo;ll show you what&rsquo;s <span class="lit">still lit</span>.
        </h1>

        <p class="hero__lede muted">
          A stay is a span, not a date. Every room here is shown against the nights you
          actually need it &mdash; so a room free on the day the last guest leaves shows
          as free.
        </p>

        <form class="search" (ngSubmit)="search()">
          <div class="search__field">
            <label for="where">Where</label>
            <input
              id="where"
              class="input"
              name="where"
              [(ngModel)]="city"
              placeholder="Anywhere"
              autocomplete="off"
            />
          </div>

          <div class="search__field">
            <label for="from">Check in</label>
            <input
              id="from"
              class="input input--num"
              type="date"
              name="from"
              [min]="minDate"
              [(ngModel)]="checkIn"
              (ngModelChange)="onCheckInChange()"
            />
          </div>

          <div class="search__field">
            <label for="to">Check out</label>
            <input
              id="to"
              class="input input--num"
              type="date"
              name="to"
              [min]="minCheckOut()"
              [(ngModel)]="checkOut"
            />
          </div>

          <div class="search__field search__field--narrow">
            <label for="guests">Guests</label>
            <input
              id="guests"
              class="input input--num"
              type="number"
              name="guests"
              min="1"
              max="20"
              [(ngModel)]="guests"
            />
          </div>

          <button class="btn search__go" type="submit">Search</button>
        </form>

        <p class="nights num" aria-live="polite">
          @if (nights() > 0) {
            {{ nights() }} night{{ nights() === 1 ? '' : 's' }}
          } @else {
            Check-out must be after check-in
          }
        </p>

        <div class="hero__ribbon" aria-hidden="true">
          <app-ribbon
            [from]="ribbonFrom"
            [to]="ribbonTo"
            [occupied]="demoOccupied"
            [selectedFrom]="checkIn"
            [selectedTo]="checkOut"
            [showScale]="true"
          />
          <p class="legend">
            <span class="key key--free"></span> free
            <span class="key key--taken"></span> occupied
            <span class="key key--yours"></span> your span
          </p>
        </div>
      </div>
    </section>

    <section class="page how">
      <h2>How a booking works</h2>

      <ol class="steps">
        <li>
          <span class="steps__n num">01</span>
          <h3>Pick your nights</h3>
          <p class="muted">
            Availability is worked out for the whole span at once, so what you see is
            bookable.
          </p>
        </li>
        <li>
          <span class="steps__n num">02</span>
          <h3>Choose a room</h3>
          <p class="muted">
            Prices are per night, per guest, with children charged at the room&rsquo;s child
            rate.
          </p>
        </li>
        <li>
          <span class="steps__n num">03</span>
          <h3>Pay to confirm</h3>
          <p class="muted">
            The room is held while you pay. Payments here are simulated &mdash; no card is
            ever charged or stored.
          </p>
        </li>
      </ol>

      <p>
        <a routerLink="/search" class="btn">Browse every property</a>
      </p>
    </section>
  `,
  styles: [
    `
      .hero {
        border-bottom: 1px solid var(--line);
        padding: var(--s8) 0 var(--s7);
      }

      .hero__title {
        max-width: 18ch;
      }

      .lit {
        color: var(--lamp);
        position: relative;
        white-space: nowrap;
      }

      .hero__lede {
        max-width: 54ch;
        font-size: 1.05rem;
      }

      .search {
        display: flex;
        gap: var(--s3);
        flex-wrap: wrap;
        align-items: flex-end;
        margin-top: var(--s6);
        padding: var(--s4);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
      }

      .search__field {
        flex: 1 1 10rem;
        min-width: 8rem;
      }

      .search__field--narrow {
        flex: 0 1 6rem;
      }

      .search__field label {
        display: block;
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-faint);
        margin-bottom: var(--s1);
        font-family: var(--mono);
      }

      .search__go {
        flex: 0 0 auto;
        height: 2.6rem;
      }

      .nights {
        margin-top: var(--s3);
        font-size: 0.8rem;
        color: var(--ink-faint);
      }

      .hero__ribbon {
        margin-top: var(--s6);
        max-width: 46rem;
      }

      .legend {
        display: flex;
        align-items: center;
        gap: var(--s2);
        margin-top: var(--s3);
        font-size: 0.75rem;
        color: var(--ink-faint);
        font-family: var(--mono);
      }

      .key {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 1px;
        display: inline-block;
      }

      .key--free { background: var(--surface-sunk); }
      .key--taken { background: var(--lamp); }
      .key--yours { background: var(--pool-soft); outline: 2px solid var(--pool); outline-offset: -2px; }

      .key + .key {
        margin-left: var(--s4);
      }

      .how {
        padding: var(--s7) var(--s5);
      }

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
        color: var(--lamp);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .steps h3 {
        margin: var(--s2) 0 var(--s1);
      }

      .steps p {
        font-size: 0.9rem;
        margin: 0;
      }
    `,
  ],
})
export class HomeComponent {
  private readonly router = inject(Router);

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
