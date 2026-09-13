import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { formatDate, formatMoney } from '../core/dates';
import { Reservation } from '../core/models';
import { ToastService } from '../core/toast.service';
import { RibbonComponent } from '../shared/ribbon.component';
import { StatusComponent } from '../shared/status.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [RouterLink, RibbonComponent, StatusComponent],
  template: `
    <div class="page wrap">
      <header class="head">
        <div>
          <p class="eyebrow">Signed in as {{ auth.user()?.email }}</p>
          <h1>My stays</h1>
        </div>
      </header>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'upcoming'"
          [class.on]="tab() === 'upcoming'"
          (click)="setTab('upcoming')"
        >
          Upcoming
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab() === 'past'"
          [class.on]="tab() === 'past'"
          (click)="setTab('past')"
        >
          Past &amp; cancelled
        </button>
      </div>

      @if (loading()) {
        @for (i of [1, 2]; track i) {
          <div class="skeleton" style="height: 7rem; margin-bottom: 1rem"></div>
        }
      } @else if (reservations().length === 0) {
        <div class="empty">
          <h3>{{ tab() === 'upcoming' ? 'Nothing booked yet' : 'No past stays' }}</h3>
          <p>
            {{
              tab() === 'upcoming'
                ? 'When you book a room it will appear here.'
                : 'Stays show up here once they are complete or cancelled.'
            }}
          </p>
          <a routerLink="/search" class="btn">Find a room</a>
        </div>
      } @else {
        <ul class="list">
          @for (r of reservations(); track r.id) {
            <li class="card item">
              <div class="item__main">
                <div class="item__head">
                  <h2>
                    <a [routerLink]="['/reservations', r.id]">{{ r.hotelName }}</a>
                  </h2>
                  <app-status [value]="r.status" />
                </div>

                <p class="muted small num">
                  {{ r.reference }} &middot; room {{ r.roomNumber }} &middot;
                  {{ fmt(r.checkIn) }} &rarr; {{ fmt(r.checkOut) }} &middot;
                  {{ r.nights }} night{{ r.nights === 1 ? '' : 's' }}
                </p>

                <app-ribbon
                  class="item__ribbon"
                  [from]="r.checkIn"
                  [to]="r.checkOut"
                  [selectedFrom]="r.checkIn"
                  [selectedTo]="r.checkOut"
                  [compact]="true"
                  [showScale]="false"
                />
              </div>

              <div class="item__side">
                <span class="num total">{{ money(r.totalPrice) }}</span>

                @if (r.canReview) {
                  <a class="btn btn--sm" [routerLink]="['/reservations', r.id]">Leave a review</a>
                } @else if (r.status === 'Pending') {
                  <a class="btn btn--sm" [routerLink]="['/reservations', r.id]">Complete payment</a>
                } @else {
                  <a class="btn btn--ghost btn--sm" [routerLink]="['/reservations', r.id]">Details</a>
                }
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
        margin-bottom: var(--s4);
      }

      .tabs {
        display: flex;
        gap: var(--s4);
        border-bottom: 1px solid var(--line);
        margin-bottom: var(--s5);
      }

      .tabs button {
        background: none;
        border: 0;
        border-bottom: 2px solid transparent;
        padding: var(--s2) 0;
        cursor: pointer;
        color: var(--ink-soft);
        font-size: 0.95rem;
      }

      .tabs .on {
        color: var(--ink);
        border-bottom-color: var(--lamp);
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
        gap: var(--s5);
        justify-content: space-between;
        padding: var(--s4);
        flex-wrap: wrap;
      }

      .item__main {
        flex: 1 1 22rem;
        min-width: 0;
      }

      .item__head {
        display: flex;
        align-items: center;
        gap: var(--s3);
        flex-wrap: wrap;
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

      .item__ribbon {
        margin-top: var(--s3);
        max-width: 20rem;
      }

      .item__side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        gap: var(--s2);
      }

      .total {
        font-size: 1.15rem;
        font-weight: 600;
      }

      .small {
        font-size: 0.85rem;
        margin: var(--s1) 0 0;
      }
    `,
  ],
})
export class AccountComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toasts = inject(ToastService);

  protected readonly auth = inject(AuthService);

  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly loading = signal(true);
  protected readonly tab = signal<'upcoming' | 'past'>('upcoming');

  protected readonly fmt = formatDate;

  ngOnInit(): void {
    this.load();
  }

  protected setTab(tab: 'upcoming' | 'past'): void {
    if (this.tab() === tab) return;

    this.tab.set(tab);
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.api.myReservations(this.tab() === 'upcoming', 1, 50).subscribe({
      next: (page) => {
        this.reservations.set(page.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.fromError(err, 'Could not load your stays.');
        this.loading.set(false);
      },
    });
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
