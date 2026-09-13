import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { dayOfMonth, formatDate, isWeekend, nightsIn, weekdayInitial } from '../core/dates';

interface Night {
  date: string;
  occupied: boolean;
  selected: boolean;
  weekend: boolean;
  day: number;
  initial: string;
  firstOfMonth: boolean;
}

/**
 * The occupancy ribbon: a band of nights on which a stay renders as one
 * continuous bar.
 *
 * A stay occupies [checkIn, checkOut), so a departure and an arrival on the same
 * date appear as two adjacent bars rather than an overlap — the ribbon shows the
 * turnover exactly as the booking rules define it.
 */
@Component({
  selector: 'app-ribbon',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="ribbon" [class.ribbon--compact]="compact()">
      @if (label(); as text) {
        <div class="ribbon__label num">{{ text }}</div>
      }

      <div
        class="ribbon__track"
        role="img"
        [attr.aria-label]="description()"
      >
        @for (night of nights(); track night.date) {
          <div
            class="cell"
            [ngClass]="{
              'cell--occupied': night.occupied,
              'cell--selected': night.selected,
              'cell--weekend': night.weekend
            }"
            [title]="tooltip(night)"
          >
            @if (showScale() && !compact()) {
              <span class="cell__day num">{{ night.day }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ribbon {
        display: flex;
        align-items: stretch;
        gap: var(--s3);
      }

      .ribbon__label {
        flex: 0 0 auto;
        min-width: 3.2rem;
        font-size: 0.8rem;
        color: var(--ink-soft);
        display: flex;
        align-items: center;
      }

      /* Wide ribbons scroll inside themselves; the page never scrolls sideways. */
      .ribbon__track {
        display: flex;
        gap: 2px;
        flex: 1 1 auto;
        overflow-x: auto;
        scrollbar-width: thin;
      }

      .cell {
        flex: 1 0 auto;
        min-width: 10px;
        height: 2.2rem;
        background: var(--surface-sunk);
        border-radius: 1px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 2px;
        position: relative;
      }

      .ribbon--compact .cell {
        height: 0.55rem;
        min-width: 4px;
      }

      .cell--weekend:not(.cell--occupied) {
        background: var(--line);
      }

      /* --lamp means one thing only: this night is taken. */
      .cell--occupied {
        background: var(--lamp);
      }

      /* Adjacent occupied cells read as a single bar. */
      .cell--occupied + .cell--occupied {
        margin-left: -2px;
        padding-left: 2px;
      }

      .cell--selected {
        outline: 2px solid var(--pool);
        outline-offset: -2px;
        background: var(--pool-soft);
      }

      .cell--selected.cell--occupied {
        background: var(--lamp);
      }

      .cell__day {
        font-size: 0.55rem;
        color: var(--ink-faint);
        line-height: 1;
      }

      .cell--occupied .cell__day {
        color: #6b4c0d;
      }
    `,
  ],
})
export class RibbonComponent {
  /** First night shown. */
  readonly from = input.required<string>();

  /** Exclusive end of the window. */
  readonly to = input.required<string>();

  /** Nights already taken. */
  readonly occupied = input<string[]>([]);

  /** A span the viewer is considering, highlighted against the rest. */
  readonly selectedFrom = input<string | null>(null);
  readonly selectedTo = input<string | null>(null);

  /** Row label, typically a room number. */
  readonly label = input<string | null>(null);

  readonly showScale = input(true);
  readonly compact = input(false);

  protected readonly nights = computed<Night[]>(() => {
    const taken = new Set(this.occupied());
    const selFrom = this.selectedFrom();
    const selTo = this.selectedTo();

    return nightsIn(this.from(), this.to()).map((date) => ({
      date,
      occupied: taken.has(date),
      selected: selFrom !== null && selTo !== null && date >= selFrom && date < selTo,
      weekend: isWeekend(date),
      day: dayOfMonth(date),
      initial: weekdayInitial(date),
      firstOfMonth: dayOfMonth(date) === 1,
    }));
  });

  protected readonly description = computed(() => {
    const all = this.nights();
    const taken = all.filter((n) => n.occupied).length;
    const room = this.label();

    const subject = room ? `Room ${room}` : 'Availability';

    return `${subject}: ${taken} of ${all.length} nights occupied between ${formatDate(
      this.from()
    )} and ${formatDate(this.to())}.`;
  });

  protected tooltip(night: Night): string {
    return `${formatDate(night.date)} — ${night.occupied ? 'occupied' : 'free'}`;
  }
}
