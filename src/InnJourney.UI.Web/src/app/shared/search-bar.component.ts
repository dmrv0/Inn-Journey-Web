import { Component, OnChanges, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { addDays, today } from '../core/dates';
import { IconComponent } from './icon.component';

export interface StaySearch {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

/**
 * The one search question, asked the same way everywhere: where, which nights,
 * how many people. Segments share a single white surface because they are one
 * question, not four.
 */
@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <form class="bar" [class.bar--raised]="raised()" (ngSubmit)="submit()">
      <div class="seg seg--where">
        <label for="sb-where">Where</label>
        <div class="seg__value">
          <app-icon name="pin" />
          <input
            id="sb-where"
            name="where"
            [(ngModel)]="city"
            placeholder="Any city"
            autocomplete="off"
          />
        </div>
      </div>

      <div class="seg">
        <label for="sb-in">Check-in</label>
        <div class="seg__value">
          <input
            id="sb-in"
            type="date"
            name="checkIn"
            [min]="minDate"
            [(ngModel)]="checkIn"
            (ngModelChange)="keepSpanValid()"
          />
        </div>
      </div>

      <div class="seg">
        <label for="sb-out">Check-out</label>
        <div class="seg__value">
          <input
            id="sb-out"
            type="date"
            name="checkOut"
            [min]="minCheckOut()"
            [(ngModel)]="checkOut"
          />
        </div>
      </div>

      <div class="seg seg--guests">
        <label for="sb-guests">Guests</label>
        <div class="seg__value">
          <app-icon name="user" />
          <select id="sb-guests" name="guests" [(ngModel)]="guests">
            @for (n of guestOptions; track n) {
              <option [ngValue]="n">{{ n }} {{ n === 1 ? 'guest' : 'guests' }}</option>
            }
          </select>
          <app-icon class="seg__caret" name="chevron-down" [size]="16" />
        </div>
      </div>

      <button class="go" type="submit">
        <app-icon name="search" [size]="18" [stroke]="2" />
        {{ cta() }}
      </button>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .bar {
        display: grid;
        grid-template-columns: minmax(10rem, 1.6fr) repeat(2, minmax(9rem, 1fr)) minmax(9rem, 1fr) auto;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .bar--raised {
        border-color: transparent;
        box-shadow: 0 24px 48px -24px rgb(20 20 50 / 45%);
      }

      .seg {
        position: relative;
        padding: 0.8rem 1.15rem;
        border-right: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        transition: background 120ms ease;
      }

      .seg:focus-within {
        background: var(--band);
      }

      .seg label {
        font-size: 0.78rem;
        color: var(--ink-faint);
        margin-bottom: 0.2rem;
      }

      .seg__value {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--ink);
      }

      .seg__value app-icon {
        color: var(--ink-soft);
      }

      .seg input,
      .seg select {
        border: 0;
        padding: 0;
        background: transparent;
        font-size: 1rem;
        font-weight: 500;
        color: var(--ink);
        width: 100%;
        min-width: 0;
        font-variant-numeric: tabular-nums;
      }

      .seg select {
        appearance: none;
        cursor: pointer;
        padding-right: 1.4rem;
      }

      .seg__caret {
        position: absolute;
        right: 1rem;
        pointer-events: none;
      }

      .seg input:focus,
      .seg select:focus {
        outline: none;
      }

      .seg input::placeholder {
        color: var(--ink-faint);
        font-weight: 400;
      }

      .seg input::-webkit-calendar-picker-indicator {
        opacity: 0.55;
        cursor: pointer;
      }

      .go {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.55rem;
        border: 0;
        padding: 0 2rem;
        background: var(--pool);
        color: #fff;
        font-weight: 600;
        font-size: 0.98rem;
        cursor: pointer;
        white-space: nowrap;
        transition: background 120ms ease;
      }

      .go:hover {
        background: var(--pool-deep);
      }

      .go:focus-visible {
        outline-offset: -4px;
        outline-color: #fff;
      }

      @media (max-width: 980px) {
        .bar {
          grid-template-columns: 1fr 1fr;
        }

        .seg--where {
          grid-column: 1 / -1;
        }

        .seg {
          border-bottom: 1px solid var(--line);
        }

        .seg:nth-child(3),
        .seg--guests {
          border-right: 0;
        }

        .seg--guests {
          grid-column: 1 / -1;
        }

        .go {
          grid-column: 1 / -1;
          padding: 0.95rem;
        }
      }
    `,
  ],
})
export class SearchBarComponent implements OnChanges {
  readonly initial = input<Partial<StaySearch>>({});
  readonly cta = input('Search');
  readonly raised = input(false);

  readonly searched = output<StaySearch>();

  protected readonly minDate = today();
  protected readonly guestOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  protected city = '';
  protected checkIn = addDays(today(), 14);
  protected checkOut = addDays(today(), 17);
  protected guests = 2;

  ngOnChanges(): void {
    const start = this.initial();

    this.city = start.city ?? this.city;
    this.checkIn = start.checkIn || this.checkIn;
    this.checkOut = start.checkOut || this.checkOut;
    this.guests = start.guests ?? this.guests;
  }

  protected minCheckOut(): string {
    return addDays(this.checkIn, 1);
  }

  /** Keep the span valid rather than letting someone submit what the API rejects. */
  protected keepSpanValid(): void {
    if (this.checkOut <= this.checkIn) {
      this.checkOut = addDays(this.checkIn, 1);
    }
  }

  protected submit(): void {
    this.keepSpanValid();

    this.searched.emit({
      city: this.city.trim(),
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      guests: this.guests,
    });
  }
}
