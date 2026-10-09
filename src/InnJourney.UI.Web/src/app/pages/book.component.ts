import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { formatDate, formatMoney, nightsBetween } from '../core/dates';
import { Reservation, Room } from '../core/models';
import { ToastService, describeError, fieldErrors } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { RibbonComponent } from '../shared/ribbon.component';

type Step = 'review' | 'pay';

@Component({
  selector: 'app-book',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, RibbonComponent],
  template: `
    <div class="page wrap">
      <a class="back" [routerLink]="['/hotels', room()?.hotelId]">
        <app-icon name="chevron-left" [size]="16" />
        Back to the property
      </a>

      <ol class="steps" aria-label="Progress">
        <li class="on">
          <span class="steps__n">
            @if (step() === 'pay') {
              <app-icon name="check" [size]="14" [stroke]="2.4" />
            } @else {
              1
            }
          </span>
          Your stay
        </li>
        <li class="steps__rule" aria-hidden="true"></li>
        <li [class.on]="step() === 'pay'"><span class="steps__n">2</span> Payment</li>
      </ol>

      @if (loading()) {
        <div class="skeleton" style="height: 14rem"></div>
      } @else {
      @if (room(); as r) {
        <div class="grid">
          <section class="main card">
            @if (step() === 'review') {
              <h1>Confirm your stay</h1>

              <p class="muted">
                The room is held as soon as you reserve it. It is only confirmed once
                payment goes through.
              </p>

              <div class="pair">
                <div class="field">
                  <label for="adults">Adults</label>
                  <input id="adults" class="input input--num" type="number" min="1" [max]="r.capacity" [(ngModel)]="adults" />
                </div>

                <div class="field">
                  <label for="children">Children</label>
                  <input id="children" class="input input--num" type="number" min="0" [max]="r.capacity" [(ngModel)]="children" />
                </div>
              </div>

              @if (guests() > r.capacity) {
                <p class="error-text">This room sleeps {{ r.capacity }}. Reduce the party size.</p>
              }

              @if (error()) {
                <p class="error-text" role="alert">{{ error() }}</p>
              }

              <button
                class="btn btn--lg"
                type="button"
                [disabled]="busy() || guests() > r.capacity"
                (click)="reserve()"
              >
                {{ busy() ? 'Holding the room…' : 'Reserve this room' }}
              </button>
            } @else {
              <h1>Payment</h1>

              <p class="notice notice--held">
                <app-icon name="lock" [size]="18" />
                <span>
                  Held under <strong class="code">{{ reservation()?.reference }}</strong>. Complete
                  payment to confirm.
                </span>
              </p>

              <div class="testcards">
                <p class="testcards__title">
                  <app-icon name="card" [size]="18" />
                  Demonstration only
                </p>
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

                <div class="buttons">
                  <button class="btn btn--lg" type="submit" [disabled]="busy() || payForm.invalid">
                    <app-icon name="shield" [size]="18" />
                    {{ busy() ? 'Taking payment…' : 'Pay ' + money(total()) }}
                  </button>

                  <button class="btn btn--ghost btn--lg" type="button" (click)="abandon()" [disabled]="busy()">
                    Cancel this hold
                  </button>
                </div>
              </form>
            }
          </section>

          <aside class="summary card">
            @if (hotelPhoto(); as photo) {
              <img class="summary__photo" [src]="photo" alt="" />
            }

            <h2 class="summary__hotel">{{ hotelName() }}</h2>
            <p class="muted small">
              {{ r.roomType?.name || 'Room' }}, room <span class="num">{{ r.number }}</span>
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
          </aside>
        </div>
      }
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: var(--s5) var(--s5) var(--s8);
      }

      .back {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        font-size: 0.88rem;
        color: var(--ink-soft);
        text-decoration: none;
        margin-bottom: var(--s4);
      }

      /* Numbered because booking genuinely is a sequence of two steps. */
      .steps {
        list-style: none;
        display: flex;
        align-items: center;
        gap: var(--s3);
        padding: 0;
        margin: 0 0 var(--s5);
        font-size: 0.92rem;
        font-weight: 500;
        color: var(--ink-faint);
      }

      .steps li {
        display: inline-flex;
        align-items: center;
        gap: var(--s2);
      }

      .steps__n {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--line-strong);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .steps .on {
        color: var(--ink);
      }

      .steps .on .steps__n {
        background: var(--pool);
        border-color: var(--pool);
        color: #fff;
      }

      .steps__rule {
        width: 3rem;
        height: 1px;
        background: var(--line-strong);
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 22rem;
        gap: var(--s5);
        align-items: start;
      }

      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }

      .main {
        padding: clamp(1.25rem, 3vw, 2rem);
      }

      .main h1 {
        font-size: 1.6rem;
      }

      .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s3);
        max-width: 26rem;
      }

      .summary {
        padding: var(--s3) var(--s3) var(--s5);
        position: sticky;
        top: calc(var(--nav-h) + var(--s4));
      }

      .summary > :not(img) {
        margin-left: var(--s3);
        margin-right: var(--s3);
      }

      .summary__photo {
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border-radius: var(--radius);
        margin-bottom: var(--s4);
      }

      .summary__hotel {
        font-size: 1.15rem;
        margin-bottom: var(--s1);
      }

      .summary__ribbon {
        display: block;
        margin-top: var(--s4);
        margin-bottom: var(--s4);
      }

      .lines {
        margin: 0;
        font-size: 0.9rem;
      }

      .lines > div {
        display: flex;
        justify-content: space-between;
        gap: var(--s3);
        padding: 0.35rem 0;
      }

      .lines dt {
        color: var(--ink-soft);
      }

      .lines dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }

      .lines__total {
        border-top: 1px solid var(--line);
        margin-top: var(--s2);
        padding-top: var(--s3) !important;
        font-weight: 600;
        font-size: 1.05rem;
      }

      .lines__total dt {
        color: var(--ink);
      }

      .triple {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--s3);
      }

      .testcards {
        margin-bottom: var(--s5);
        padding: var(--s4);
        border: 1px dashed var(--line-strong);
        border-radius: var(--radius);
      }

      .testcards__title {
        display: flex;
        align-items: center;
        gap: var(--s2);
        font-weight: 600;
        margin-bottom: var(--s2);
      }

      .testcards p:last-child {
        margin: 0;
      }

      .linklike {
        background: none;
        border: 0;
        padding: 0;
        color: var(--pool);
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
        font-size: inherit;
        font-family: var(--mono);
      }

      .small {
        font-size: 0.87rem;
      }

      .buttons {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s3);
        margin-top: var(--s2);
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
  protected readonly hotelPhoto = signal<string | null>(null);
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
          next: (hotel) => {
            this.hotelName.set(hotel.name);
            this.hotelPhoto.set((hotel.images.find((i) => i.isCover) ?? hotel.images[0])?.url ?? null);
          },
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
