import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { formatDate, formatMoney } from '../core/dates';
import { Reservation } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { RibbonComponent } from '../shared/ribbon.component';
import { StatusComponent } from '../shared/status.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [RouterLink, IconComponent, RibbonComponent, StatusComponent],
  template: `
    <div class="page wrap">
      <header class="page-head">
        <div>
          <h1>My stays</h1>
          <p class="muted">Signed in as {{ auth.user()?.email }}</p>
        </div>
        <a routerLink="/search" class="btn btn--pill">
          <app-icon name="search" [size]="16" [stroke]="2" />
          Find a stay
        </a>
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
              <a class="item__photo" [routerLink]="['/reservations', r.id]" tabindex="-1" aria-hidden="true">
                @if (photos()[r.hotelId]; as photo) {
                  <img [src]="photo" alt="" loading="lazy" />
                }
              </a>

              <div class="item__main">
                <div class="item__head">
                  <h2>
                    <a [routerLink]="['/reservations', r.id]">{{ r.hotelName }}</a>
                  </h2>
                  <app-status [value]="r.status" />
                </div>

                <ul class="facts">
                  <li><app-icon name="calendar" [size]="16" /> {{ fmt(r.checkIn) }} &ndash; {{ fmt(r.checkOut) }}</li>
                  <li><app-icon name="moon" [size]="16" /> {{ r.nights }} night{{ r.nights === 1 ? '' : 's' }}</li>
                  <li><app-icon name="bed" [size]="16" /> Room {{ r.roomNumber }}</li>
                  <li class="code">{{ r.reference }}</li>
                </ul>

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
                <span class="total num">{{ money(r.totalPrice) }}</span>

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
        padding-bottom: var(--s8);
      }

      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--s4);
      }

      .item {
        display: grid;
        grid-template-columns: 11rem minmax(0, 1fr) auto;
        gap: var(--s5);
        align-items: center;
        padding: 0.6rem var(--s5) 0.6rem 0.6rem;
      }

      .item__photo {
        display: block;
        align-self: stretch;
        min-height: 7.5rem;
        border-radius: var(--radius);
        overflow: hidden;
        background: linear-gradient(150deg, #2b2457, #6941e5);
      }

      .item__photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .item__head {
        display: flex;
        align-items: center;
        gap: var(--s3);
        flex-wrap: wrap;
        margin-bottom: var(--s2);
      }

      .item h2 {
        margin: 0;
        font-size: 1.1rem;
      }

      .item h2 a {
        color: inherit;
        text-decoration: none;
      }

      .item h2 a:hover {
        color: var(--pool);
      }

      .facts {
        flex-wrap: wrap;
        gap: var(--s2) var(--s4);
      }

      .facts .code {
        font-size: 0.8rem;
        color: var(--ink-faint);
      }

      .item__ribbon {
        display: block;
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
        font-weight: 700;
      }

      @media (max-width: 760px) {
        .item {
          grid-template-columns: 1fr;
          padding: 0.6rem 0.6rem var(--s4);
        }

        .item__photo {
          aspect-ratio: 16 / 7;
          min-height: 0;
        }

        .item__main,
        .item__side {
          padding: 0 0.4rem;
        }

        .item__side {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }
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

  /** Cover photographs by hotel id, fetched once per hotel. */
  protected readonly photos = signal<Record<string, string | null>>({});

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
        this.loadPhotos(page.items);
      },
      error: (err) => {
        this.toasts.fromError(err, 'Could not load your stays.');
        this.loading.set(false);
      },
    });
  }

  private loadPhotos(reservations: Reservation[]): void {
    const missing = [...new Set(reservations.map((r) => r.hotelId))].filter(
      (id) => !(id in this.photos())
    );

    for (const id of missing) {
      this.photos.update((all) => ({ ...all, [id]: null }));

      this.api.getHotel(id).subscribe({
        next: (h) => {
          const url = (h.images.find((i) => i.isCover) ?? h.images[0])?.url ?? null;
          this.photos.update((all) => ({ ...all, [id]: url }));
        },
        error: () => undefined,
      });
    }
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
