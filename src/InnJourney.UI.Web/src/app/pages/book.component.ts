import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { formatDate, formatMoney, nightsBetween } from '../core/dates';
import { Reservation, Room } from '../core/models';
import { ToastService, describeError, fieldErrors } from '../core/toast.service';
import { RibbonComponent } from '../shared/ribbon.component';

type Step = 'review' | 'pay';

@Component({
  selector: 'app-book',
  standalone: true,
  imports: [FormsModule, RouterLink, RibbonComponent],
  template: `
    <div class="page wrap">
      <ol class="steps" aria-label="Progress">
        <li [class.on]="true"><span class="num">01</span> Your stay</li>
        <li [class.on]="step() === 'pay'"><span class="num">02</span> Payment</li>
      </ol>

      @if (loading()) {
        <div class="skeleton" style="height: 14rem"></div>
      } @else {
      @if (room(); as r) {
        <div class="grid">
          <section class="main">
            @if (step() === 'review') {
              <h1>Confirm your stay</h1>

              <p class="muted">
                The room is held as soon as you reserve it. It is only confirmed once
                payment goes through.
              </p>

              <div class="field">
                <label for="adults">Adults</label>
                <input id="adults" class="input input--num" type="number" min="1" [max]="r.capacity" [(ngModel)]="adults" />
              </div>

              <div class="field">
                <label for="children">Children</label>
                <input id="children" class="input input--num" type="number" min="0" [max]="r.capacity" [(ngModel)]="children" />
              </div>

              @if (guests() > r.capacity) {
                <p class="error-text">This room sleeps {{ r.capacity }}. Reduce the party size.</p>
              }

              @if (error()) {
                <p class="error-text" role="alert">{{ error() }}</p>
              }

              <button
                class="btn"
                type="button"
                [disabled]="busy() || guests() > r.capacity"
                (click)="reserve()"
              >
                {{ busy() ? 'Holding the room…' : 'Reserve this room' }}
              </button>
            } @else {
              <h1>Payment</h1>

              <p class="held">
                Held under <strong class="num">{{ reservation()?.reference }}</strong>. Complete
                payment to confirm.
              </p>

              <div class="testcards">
                <p class="eyebrow">Demonstration only</p>
                <p class="muted small">
                  No card is charged or stored. Use
                  <button type="button" class="linklike num" (click)="fill('4242424242424242')">
                    4242 4242 4242 4242
                  </button>
                  to be approved, or
                  <button type="button" class="linklike num" (click)="fill('4000000000000002')">
                    4000 0000 0000 0002
                  </button>
                  to see a decline.
                </p>
              </div>

              <form (ngSubmit)="pay()" #payForm="ngForm">
                <div class="field">
                  <label for="holder">Name on card</label>
                  <input id="holder" class="input" name="holder" [(ngModel)]="cardHolderName" required />
                  @if (errors()['cardHolderName']) {
                    <p class="error-text">{{ errors()['cardHolderName'] }}</p>
                  }
                </div>

                <div class="field">
                  <label for="number">Card number</label>
                  <input
                    id="number"
                    class="input input--num"
                    name="number"
                    inputmode="numeric"
                    autocomplete="cc-number"
                    [(ngModel)]="cardNumber"
                    required
                  />
                  @if (errors()['cardNumber']) {
                    <p class="error-text">{{ errors()['cardNumber'] }}</p>
                  }
                </div>

                <div class="triple">
                  <div class="field">
                    <label for="mm">Month</label>
                    <input id="mm" class="input input--num" name="mm" placeholder="12" [(ngModel)]="expiryMonth" required />
                  </div>
                  <div class="field">
                    <label for="yy">Year</label>
                    <input id="yy" class="input input--num" name="yy" placeholder="2030" [(ngModel)]="expiryYear" required />
                  </div>
                  <div class="field">
                    <label for="cvc">Security code</label>
                    <input id="cvc" class="input input--num" name="cvc" placeholder="123" [(ngModel)]="cvc" required />
                  </div>
                </div>

                @if (error()) {
                  <p class="error-text" role="alert">{{ error() }}</p>
                }

                <button class="btn" type="submit" [disabled]="busy() || payForm.invalid">
                  {{ busy() ? 'Taking payment…' : 'Pay ' + money(total()) }}
                </button>

                <button class="btn btn--ghost" type="button" (click)="abandon()" [disabled]="busy()">
                  Cancel this hold
                </button>
              </form>
            }
          </section>

          <aside class="summary card">
            <p class="eyebrow">Your stay</p>

            <h2 class="summary__hotel">{{ hotelName() }}</h2>
            <p class="muted small">
              {{ r.roomType?.name || 'Room' }} &middot; no. <span class="num">{{ r.number }}</span>
            </p>

            <app-ribbon
              class="summary__ribbon"
              [from]="checkIn"
              [to]="checkOut"
              [selectedFrom]="checkIn"
              [selectedTo]="checkOut"
              [showScale]="false"
            />

            <dl class="lines">
              <div>
                <dt>Check in</dt>
                <dd class="num">{{ fmt(checkIn) }}</dd>
              </div>
              <div>
                <dt>Check out</dt>
                <dd class="num">{{ fmt(checkOut) }}</dd>
              </div>
              <div>
                <dt>Nights</dt>
                <dd class="num">{{ nights() }}</dd>
              </div>
              <div>
                <dt>{{ adults }} adult{{ adults === 1 ? '' : 's' }} &times; {{ nights() }}</dt>
                <dd class="num">{{ money(r.adultPrice * adults * nights()) }}</dd>
              </div>
              @if (children > 0) {
                <div>
                  <dt>{{ children }} child{{ children === 1 ? '' : 'ren' }} &times; {{ nights() }}</dt>
                  <dd class="num">{{ money(r.childPrice * children * nights()) }}</dd>
                </div>
              }
              <div class="lines__total">
                <dt>Total</dt>
                <dd class="num">{{ money(total()) }}</dd>
              </div>
            </dl>

            <a class="muted small" [routerLink]="['/hotels', r.hotelId]">Back to the property</a>
          </aside>
        </div>
      }
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: var(--s6) var(--s5) var(--s8);
      }

      .steps {
        list-style: none;
        display: flex;
        gap: var(--s5);
        padding: 0;
        margin: 0 0 var(--s5);
        font-size: 0.8rem;
        font-family: var(--mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-faint);
      }

      .steps .on {
        color: var(--ink);
      }

      .steps .on span {
        color: var(--lamp);
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 20rem;
        gap: var(--s6);
        align-items: start;
      }

      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }

      .summary {
        padding: var(--s5);
        position: sticky;
        top: 5rem;
      }

      .summary__hotel {
        font-size: 1.1rem;
        margin-bottom: var(--s1);
      }

      .summary__ribbon {
        margin: var(--s4) 0;
      }

      .lines {
        margin: 0 0 var(--s4);
        font-size: 0.9rem;
      }

      .lines > div {
        display: flex;
        justify-content: space-between;
        gap: var(--s3);
        padding: var(--s1) 0;
      }

      .lines dt {
        color: var(--ink-soft);
      }

      .lines dd {
        margin: 0;
      }

      .lines__total {
        border-top: 1px solid var(--line);
        margin-top: var(--s2);
        padding-top: var(--s2) !important;
        font-weight: 600;
        font-size: 1.05rem;
      }

      .triple {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--s3);
      }

      .held {
        padding: var(--s3);
        background: var(--lamp-soft);
        border-left: 3px solid var(--lamp);
        font-size: 0.92rem;
      }

      .testcards {
        margin-bottom: var(--s4);
        padding: var(--s3);
        border: 1px dashed var(--line);
        border-radius: var(--radius);
      }

      .linklike {
        background: none;
        border: 0;
        padding: 0;
        color: var(--pool);
        cursor: pointer;
        text-decoration: underline;
        font-size: inherit;
      }

      .small {
        font-size: 0.85rem;
      }

      .btn + .btn {
        margin-left: var(--s3);
      }
    `,
  ],
})
export class BookComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected checkIn = '';
  protected checkOut = '';
  protected adults = 2;
  protected children = 0;

  protected cardHolderName = '';
  protected cardNumber = '';
  protected expiryMonth = '12';
  protected expiryYear = `${new Date().getFullYear() + 2}`;
  protected cvc = '123';

  protected readonly room = signal<Room | null>(null);
  protected readonly hotelName = signal('');
  protected readonly reservation = signal<Reservation | null>(null);
  protected readonly step = signal<Step>('review');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly nights = computed(() => nightsBetween(this.checkIn, this.checkOut));
  protected readonly guests = computed(() => this.adults + this.children);

  protected readonly total = computed(() => {
    const r = this.room();
    if (!r) return 0;

    return (r.adultPrice * this.adults + r.childPrice * this.children) * this.nights();
  });

  protected readonly fmt = formatDate;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    this.checkIn = params.get('checkIn') ?? '';
    this.checkOut = params.get('checkOut') ?? '';
    this.adults = Number(params.get('adults') ?? 2);
    this.children = Number(params.get('children') ?? 0);

    const roomId = this.route.snapshot.paramMap.get('roomId') ?? '';

    this.api.getRoom(roomId).subscribe({
      next: (room) => {
        this.room.set(room);
        this.loading.set(false);

        this.api.getHotel(room.hotelId).subscribe({
          next: (hotel) => this.hotelName.set(hotel.name),
          error: () => undefined,
        });
      },
      error: () => {
        this.loading.set(false);
        this.toasts.error('That room could not be found.');
        void this.router.navigateByUrl('/search');
      },
    });
  }

  protected reserve(): void {
    const r = this.room();
    if (!r || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    this.api
      .book({
        roomId: r.id,
        checkIn: this.checkIn,
        checkOut: this.checkOut,
        adults: this.adults,
        children: this.children,
      })
      .subscribe({
        next: (reservation) => {
          this.busy.set(false);
          this.reservation.set(reservation);
          this.step.set('pay');
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(
            describeError(err, 'Could not hold that room. The dates may have just been taken.')
          );
        },
      });
  }

  protected fill(number: string): void {
    this.cardNumber = number;
    this.cardHolderName ||= 'Test Guest';
  }

  protected pay(): void {
    const reservation = this.reservation();
    if (!reservation || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.errors.set({});

    this.api
      .pay({
        reservationId: reservation.id,
        cardHolderName: this.cardHolderName,
        cardNumber: this.cardNumber,
        expiryMonth: this.expiryMonth,
        expiryYear: this.expiryYear,
        cvc: this.cvc,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toasts.success('Booking confirmed.');
          void this.router.navigate(['/reservations', reservation.id]);
        },
        error: (err) => {
          this.busy.set(false);
          this.errors.set(fieldErrors(err));
          this.error.set(describeError(err, 'The payment was declined.'));
        },
      });
  }

  protected abandon(): void {
    const reservation = this.reservation();
    if (!reservation) return;

    this.api.cancelReservation(reservation.id).subscribe({
      next: () => {
        this.toasts.success('The hold was released.');
        void this.router.navigate(['/hotels', this.room()?.hotelId]);
      },
      error: (err) => this.toasts.fromError(err),
    });
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
