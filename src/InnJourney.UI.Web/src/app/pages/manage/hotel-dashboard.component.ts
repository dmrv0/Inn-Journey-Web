import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { addDays, formatDate, formatMoney, today } from '../../core/dates';
import {
  HotelDetail,
  Occupancy,
  Reservation,
  RevenueSummary,
  Room,
  RoomType,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { RibbonComponent } from '../../shared/ribbon.component';
import { StatusComponent } from '../../shared/status.component';

type Tab = 'board' | 'bookings' | 'rooms' | 'revenue';

@Component({
  selector: 'app-hotel-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, RibbonComponent, StatusComponent],
  template: `
    <div class="page wrap">
      <header class="head">
        <div>
          <p class="eyebrow"><a routerLink="/manage">My properties</a></p>
          <h1>{{ hotel()?.name || 'Property' }}</h1>
        </div>
        <a class="btn btn--ghost btn--sm" [routerLink]="['/hotels', hotelId]">View public page</a>
      </header>

      <nav class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === t.key"
            [class.on]="tab() === t.key"
            (click)="setTab(t.key)"
          >
            {{ t.label }}
          </button>
        }
      </nav>

      @switch (tab()) {
        @case ('board') {
          <section>
            <div class="board__head">
              <div>
                <h2>Occupancy</h2>
                <p class="muted small num">{{ fmt(from) }} &rarr; {{ fmt(to) }}</p>
              </div>

              <div class="board__nav">
                <button class="btn btn--ghost btn--sm" type="button" (click)="shift(-28)">&larr; Earlier</button>
                <button class="btn btn--ghost btn--sm" type="button" (click)="shift(28)">Later &rarr;</button>
              </div>
            </div>

            @if (loadingBoard()) {
              <div class="skeleton" style="height: 12rem"></div>
            } @else if (!occupancy()?.rooms?.length) {
              <div class="empty">
                <h3>No rooms yet</h3>
                <p>Add a room and its nights will appear on this board.</p>
                <button class="btn" type="button" (click)="setTab('rooms')">Add a room</button>
              </div>
            } @else {
              <div class="board card">
                @for (row of occupancy()!.rooms; track row.roomId) {
                  <app-ribbon
                    class="board__row"
                    [from]="from"
                    [to]="to"
                    [label]="row.number"
                    [occupied]="row.occupiedDates"
                  />
                }
              </div>

              <p class="legend">
                <span class="key key--taken"></span> occupied
                <span class="key key--free"></span> free
                &mdash; a bar ending where the next begins is a turnover, not a clash.
              </p>
            }
          </section>
        }

        @case ('bookings') {
          <section>
            <h2>Bookings</h2>

            @if (loadingBookings()) {
              <div class="skeleton" style="height: 10rem"></div>
            } @else if (bookings().length === 0) {
              <div class="empty"><h3>No bookings yet</h3></div>
            } @else {
              <table class="table">
                <caption class="visually-hidden">Bookings at this property</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Room</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Guests</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span class="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (b of bookings(); track b.id) {
                    <tr>
                      <td class="num">{{ b.reference }}</td>
                      <td class="num">{{ b.roomNumber }}</td>
                      <td class="num nowrap">{{ fmt(b.checkIn) }} &rarr; {{ fmt(b.checkOut) }}</td>
                      <td class="num">{{ b.adults + b.children }}</td>
                      <td class="num">{{ money(b.totalPrice) }}</td>
                      <td><app-status [value]="b.status" /></td>
                      <td class="actions">
                        @if (b.allowedNextStatuses.includes('CheckedIn')) {
                          <button class="btn btn--sm" type="button" (click)="advance(b, 'in')">Check in</button>
                        }
                        @if (b.allowedNextStatuses.includes('CheckedOut')) {
                          <button class="btn btn--sm" type="button" (click)="advance(b, 'out')">Check out</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        @case ('rooms') {
          <section>
            <div class="board__head">
              <h2>Rooms</h2>
              <button class="btn btn--sm" type="button" (click)="showRoomForm.set(!showRoomForm())">
                {{ showRoomForm() ? 'Close' : 'Add a room' }}
              </button>
            </div>

            @if (showRoomForm()) {
              <form class="card roomform" (ngSubmit)="addRoom()" #rf="ngForm">
                <div class="row">
                  <div class="field narrow">
                    <label for="rnum">Number</label>
                    <input id="rnum" class="input input--num" name="number" [(ngModel)]="roomDraft.number" required />
                  </div>
                  <div class="field">
                    <label for="rtype">Type</label>
                    <select id="rtype" class="input" name="roomTypeId" [(ngModel)]="roomDraft.roomTypeId" required>
                      @for (t of roomTypes(); track t.id) {
                        <option [ngValue]="t.id">{{ t.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="field narrow">
                    <label for="rcap">Sleeps</label>
                    <input id="rcap" class="input input--num" type="number" min="1" name="capacity" [(ngModel)]="roomDraft.capacity" />
                  </div>
                  <div class="field narrow">
                    <label for="radult">Adult rate</label>
                    <input id="radult" class="input input--num" type="number" min="0" name="adultPrice" [(ngModel)]="roomDraft.adultPrice" />
                  </div>
                  <div class="field narrow">
                    <label for="rchild">Child rate</label>
                    <input id="rchild" class="input input--num" type="number" min="0" name="childPrice" [(ngModel)]="roomDraft.childPrice" />
                  </div>
                </div>

                <button class="btn" type="submit" [disabled]="busy() || rf.invalid">Add room</button>
              </form>
            }

            @if (rooms().length === 0) {
              <div class="empty"><h3>No rooms yet</h3><p>A property needs at least one room to take bookings.</p></div>
            } @else {
              <table class="table">
                <caption class="visually-hidden">Rooms at this property</caption>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Type</th>
                    <th scope="col">Sleeps</th>
                    <th scope="col">Adult</th>
                    <th scope="col">Child</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of rooms(); track r.id) {
                    <tr>
                      <td class="num">{{ r.number }}</td>
                      <td>{{ r.roomType?.name }}</td>
                      <td class="num">{{ r.capacity }}</td>
                      <td class="num">{{ money(r.adultPrice) }}</td>
                      <td class="num">{{ money(r.childPrice) }}</td>
                      <td><span class="tag">{{ r.status === 'Available' ? 'In service' : 'Out of service' }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        @case ('revenue') {
          <section>
            <h2>Revenue</h2>

            @if (revenue(); as rev) {
              <div class="stats">
                <div class="stat">
                  <span class="stat__label">Taken</span>
                  <span class="stat__value num">{{ money(rev.totalRevenue) }}</span>
                </div>
                <div class="stat">
                  <span class="stat__label">Paid bookings</span>
                  <span class="stat__value num">{{ rev.paidBookings }}</span>
                </div>
                <div class="stat">
                  <span class="stat__label">Average booking</span>
                  <span class="stat__value num">{{ money(rev.averageBookingValue) }}</span>
                </div>
              </div>

              @if (rev.series.length === 0) {
                <div class="empty"><h3>No payments in this window</h3></div>
              } @else {
                <div class="chart" role="img" [attr.aria-label]="chartLabel()">
                  @for (point of rev.series; track point.date) {
                    <div class="bar" [style.height.%]="barHeight(point.amount)" [title]="fmt(point.date) + ': ' + money(point.amount)"></div>
                  }
                </div>
                <p class="muted small num">{{ fmt(rev.series[0].date) }} &rarr; {{ fmt(rev.series[rev.series.length - 1].date) }}</p>
              }
            } @else {
              <div class="skeleton" style="height: 8rem"></div>
            }
          </section>
        }
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
        margin-bottom: var(--s4);
      }

      .head .eyebrow a {
        color: inherit;
      }

      .tabs {
        display: flex;
        gap: var(--s4);
        border-bottom: 1px solid var(--line);
        margin-bottom: var(--s5);
        flex-wrap: wrap;
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

      .board__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--s4);
        flex-wrap: wrap;
        margin-bottom: var(--s4);
      }

      .board__nav {
        display: flex;
        gap: var(--s2);
      }

      /* The occupancy wall: the page, not a widget on it. Rows are separated
         by hairlines rather than colour, so --lamp is the only saturated thing
         on screen and a taken night is unmistakable. */
      .board {
        padding: var(--s4);
        display: grid;
        gap: 0;
      }

      .board__row {
        padding: var(--s2) 0;
        border-bottom: 1px solid var(--line);
      }

      .board__row:last-child {
        border-bottom: 0;
      }

      .legend {
        display: flex;
        align-items: center;
        gap: var(--s2);
        margin-top: var(--s3);
        font-size: 0.78rem;
        color: var(--ink-faint);
      }

      .key {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 1px;
        display: inline-block;
      }

      .key--taken { background: var(--lamp); }
      .key--free { background: var(--surface-sunk); margin-left: var(--s3); }

      .table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .table th,
      .table td {
        text-align: left;
        padding: var(--s2) var(--s3);
        border-bottom: 1px solid var(--line);
      }

      .table th {
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-faint);
        font-family: var(--mono);
        font-weight: 500;
      }

      .nowrap {
        white-space: nowrap;
      }

      .actions {
        display: flex;
        gap: var(--s2);
        justify-content: flex-end;
      }

      .roomform {
        padding: var(--s4);
        margin-bottom: var(--s4);
      }

      .row {
        display: flex;
        gap: var(--s3);
        flex-wrap: wrap;
      }

      .row .field {
        flex: 1 1 9rem;
        margin-bottom: var(--s3);
      }

      .row .narrow {
        flex: 0 1 6.5rem;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: var(--s3);
        margin-bottom: var(--s5);
      }

      .stat {
        padding: var(--s4);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
        display: grid;
        gap: var(--s1);
      }

      .stat__label {
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-faint);
        font-family: var(--mono);
      }

      .stat__value {
        font-size: 1.5rem;
        font-weight: 600;
      }

      .chart {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 10rem;
        padding: var(--s3);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
      }

      .bar {
        flex: 1 1 auto;
        min-height: 2px;
        background: var(--pool);
        border-radius: 1px 1px 0 0;
      }

      .small {
        font-size: 0.85rem;
      }
    `,
  ],
})
export class HotelDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'board', label: 'Occupancy' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'revenue', label: 'Revenue' },
  ];

  protected hotelId = '';
  protected from = today();
  protected to = addDays(today(), 28);

  protected readonly tab = signal<Tab>('board');
  protected readonly hotel = signal<HotelDetail | null>(null);
  protected readonly occupancy = signal<Occupancy | null>(null);
  protected readonly bookings = signal<Reservation[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly roomTypes = signal<RoomType[]>([]);
  protected readonly revenue = signal<RevenueSummary | null>(null);

  protected readonly loadingBoard = signal(true);
  protected readonly loadingBookings = signal(false);
  protected readonly busy = signal(false);
  protected readonly showRoomForm = signal(false);

  protected roomDraft = {
    number: '',
    roomTypeId: '',
    capacity: 2,
    adultPrice: 100,
    childPrice: 50,
    status: 'Available',
  };

  protected readonly fmt = formatDate;

  private readonly maxRevenue = computed(() => {
    const series = this.revenue()?.series ?? [];
    return series.reduce((max, p) => Math.max(max, p.amount), 0);
  });

  ngOnInit(): void {
    this.hotelId = this.route.snapshot.paramMap.get('id') ?? '';

    this.api.getHotel(this.hotelId).subscribe({
      next: (h) => this.hotel.set(h),
      error: () => undefined,
    });

    this.loadBoard();
    this.loadRooms();

    this.api.roomTypes().subscribe({
      next: (types) => {
        this.roomTypes.set(types);
        this.roomDraft.roomTypeId = types[0]?.id ?? '';
      },
      error: () => undefined,
    });
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);

    if (tab === 'bookings' && this.bookings().length === 0) this.loadBookings();
    if (tab === 'revenue' && !this.revenue()) this.loadRevenue();
  }

  protected shift(days: number): void {
    this.from = addDays(this.from, days);
    this.to = addDays(this.to, days);
    this.loadBoard();
  }

  private loadBoard(): void {
    this.loadingBoard.set(true);

    this.api.getOccupancy(this.hotelId, this.from, this.to).subscribe({
      next: (o) => {
        this.occupancy.set(o);
        this.loadingBoard.set(false);
      },
      error: (err) => {
        this.toasts.fromError(err, 'Could not load the occupancy board.');
        this.loadingBoard.set(false);
      },
    });
  }

  private loadBookings(): void {
    this.loadingBookings.set(true);

    this.api.hotelReservations(this.hotelId, { pageSize: 50 }).subscribe({
      next: (page) => {
        this.bookings.set(page.items);
        this.loadingBookings.set(false);
      },
      error: (err) => {
        this.toasts.fromError(err, 'Could not load bookings.');
        this.loadingBookings.set(false);
      },
    });
  }

  private loadRooms(): void {
    this.api.getRooms(this.hotelId).subscribe({
      next: (page) => this.rooms.set(page.items),
      error: () => undefined,
    });
  }

  private loadRevenue(): void {
    this.api.getRevenue(this.hotelId, addDays(today(), -90), addDays(today(), 1)).subscribe({
      next: (r) => this.revenue.set(r),
      error: (err) => this.toasts.fromError(err, 'Could not load revenue.'),
    });
  }

  protected advance(booking: Reservation, direction: 'in' | 'out'): void {
    const call =
      direction === 'in'
        ? this.api.checkIn(booking.id)
        : this.api.checkOut(booking.id);

    call.subscribe({
      next: (updated) => {
        this.bookings.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
        this.toasts.success(direction === 'in' ? 'Guest checked in.' : 'Stay completed.');
        this.loadBoard();
      },
      error: (err) => this.toasts.fromError(err),
    });
  }

  protected addRoom(): void {
    if (this.busy()) return;

    this.busy.set(true);

    this.api.createRoom(this.hotelId, this.roomDraft).subscribe({
      next: () => {
        this.busy.set(false);
        this.showRoomForm.set(false);
        this.roomDraft = { ...this.roomDraft, number: '' };
        this.toasts.success('Room added.');
        this.loadRooms();
        this.loadBoard();
      },
      error: (err) => {
        this.busy.set(false);
        this.toasts.fromError(err, 'Could not add the room.');
      },
    });
  }

  protected barHeight(amount: number): number {
    const max = this.maxRevenue();
    return max === 0 ? 2 : Math.max((amount / max) * 100, 2);
  }

  protected chartLabel(): string {
    const rev = this.revenue();
    if (!rev) return '';

    return `Daily revenue across ${rev.series.length} days, totalling ${formatMoney(
      rev.totalRevenue
    )}.`;
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
