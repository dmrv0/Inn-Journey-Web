import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { formatDate, formatDateTime, formatMoney } from '../core/dates';
import { Reservation } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { RibbonComponent } from '../shared/ribbon.component';
import { StatusComponent } from '../shared/status.component';

@Component({
  selector: 'app-reservation',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, RibbonComponent, StatusComponent],
  template: `
    <div class="page wrap">
      @if (loading()) {
        <div class="skeleton" style="height: 16rem"></div>
      } @else {
      @if (reservation(); as r) {
        @if (justConfirmed()) {
          <p class="notice">
            <app-icon name="check" [size]="18" [stroke]="2.2" />
            Your booking is confirmed. A confirmation has been emailed to you.
          </p>
        }

        <header class="head">
          <div>
            <p class="eyebrow">Booking reference</p>
            <h1 class="ref code">{{ r.reference }}</h1>
          </div>
          <app-status [value]="r.status" />
        </header>

        <div class="grid">
          <section class="card detail">
            @if (hotelPhoto(); as photo) {
              <img class="detail__photo" [src]="photo" alt="" />
            }

            <h2>{{ r.hotelName }}</h2>
            <p class="muted">Room <span class="num">{{ r.roomNumber }}</span></p>

            <app-ribbon
              class="detail__ribbon"
              [from]="r.checkIn"
              [to]="r.checkOut"
              [selectedFrom]="r.checkIn"
              [selectedTo]="r.checkOut"
            />

            <dl class="lines">
              <div>
                <dt>Check in</dt>
                <dd class="num">{{ fmt(r.checkIn) }}</dd>
              </div>
              <div>
                <dt>Check out</dt>
                <dd class="num">{{ fmt(r.checkOut) }}</dd>
              </div>
              <div>
                <dt>Nights</dt>
                <dd class="num">{{ r.nights }}</dd>
              </div>
              <div>
                <dt>Guests</dt>
                <dd class="num">
                  {{ r.adults }} adult{{ r.adults === 1 ? '' : 's' }}@if (r.children) {, {{ r.children }} child{{ r.children === 1 ? '' : 'ren' }}}
                </dd>
              </div>
              <div class="lines__total">
                <dt>Total</dt>
                <dd class="num">{{ money(r.totalPrice) }}</dd>
              </div>
            </dl>

            <div class="actions">
              @if (r.allowedNextStatuses.includes('Cancelled')) {
                <button class="btn btn--danger btn--sm" type="button" [disabled]="busy()" (click)="cancel()">
                  Cancel booking
                </button>
              }
              <a class="btn btn--ghost btn--sm" [routerLink]="['/hotels', r.hotelId]">View property</a>
            </div>
          </section>

          <aside class="side">
            <section class="card pay">
              <p class="eyebrow">Payment</p>

              @if (r.payment; as payment) {
                <p class="pay__amount num">{{ money(payment.amount) }}</p>
                <app-status [value]="payment.status" />

                <dl class="lines lines--tight">
                  @if (payment.cardLast4) {
                    <div>
                      <dt>Card</dt>
                      <dd class="code">•••• {{ payment.cardLast4 }}</dd>
                    </div>
                  }
                  <div>
                    <dt>Taken</dt>
                    <dd class="num">{{ fmtTime(payment.processedAt) }}</dd>
                  </div>
                </dl>

                @if (payment.failureReason) {
                  <p class="error-text">{{ payment.failureReason }}</p>
                }
              } @else {
                <p class="muted small">Not yet paid. This booking is held, not confirmed.</p>
              }
            </section>

            @if (r.canReview) {
              <section class="card review">
                <p class="eyebrow">Your stay is complete</p>
                <h3>Leave a review</h3>

                <div class="field">
                  <label for="rating">Rating</label>
                  <select id="rating" class="input" [(ngModel)]="rating">
                    @for (n of [5, 4, 3, 2, 1]; track n) {
                      <option [ngValue]="n">{{ n }} out of 5</option>
                    }
                  </select>
                </div>

                <div class="field">
                  <label for="comment">Comment</label>
                  <textarea
                    id="comment"
                    class="input"
                    rows="4"
                    maxlength="4000"
                    [(ngModel)]="comment"
                    placeholder="What would the next guest want to know?"
                  ></textarea>
                </div>

                <button class="btn" type="button" [disabled]="busy()" (click)="submitReview()">
                  Publish review
                </button>
              </section>
            }
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

      .notice {
        align-items: center;
        background: var(--save-soft);
        color: var(--save);
        font-weight: 500;
        margin-bottom: var(--s5);
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s4);
        flex-wrap: wrap;
        margin-bottom: var(--s5);
      }

      .head .eyebrow {
        color: var(--ink-faint);
        font-weight: 500;
      }

      .ref {
        font-size: clamp(1.5rem, 1.2rem + 1vw, 2rem);
        font-weight: 500;
        margin: 0;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 21rem;
        gap: var(--s5);
        align-items: start;
      }

      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }

      .detail,
      .pay,
      .review {
        padding: var(--s5);
      }

      .detail__photo {
        width: 100%;
        aspect-ratio: 21 / 8;
        object-fit: cover;
        border-radius: var(--radius);
        margin-bottom: var(--s5);
      }

      .detail h2 {
        margin-bottom: var(--s1);
      }

      .detail__ribbon {
        display: block;
        margin: var(--s4) 0;
      }

      .lines {
        margin: 0 0 var(--s5);
        font-size: 0.92rem;
      }

      .lines > div {
        display: flex;
        justify-content: space-between;
        gap: var(--s3);
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--line);
      }

      .lines dt {
        color: var(--ink-soft);
      }

      .lines dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }

      .lines__total {
        border-bottom: 0 !important;
        padding-top: var(--s3) !important;
        font-weight: 600;
        font-size: 1.08rem;
      }

      .lines__total dt {
        color: var(--ink);
      }

      .lines--tight {
        margin-top: var(--s4);
      }

      .side {
        display: grid;
        gap: var(--s4);
      }

      .pay__amount {
        font-size: 1.7rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0 0 var(--s2);
      }

      .actions {
        display: flex;
        gap: var(--s3);
        flex-wrap: wrap;
      }

      .small {
        font-size: 0.87rem;
      }
    `,
  ],
})
export class ReservationComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  protected readonly reservation = signal<Reservation | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly justConfirmed = signal(false);
  protected readonly hotelPhoto = signal<string | null>(null);

  protected rating = 5;
  protected comment = '';

  protected readonly fmt = formatDate;
  protected readonly fmtTime = formatDateTime;

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  private load(): void {
    this.api.getReservation(this.id).subscribe({
      next: (r) => {
        this.reservation.set(r);
        this.justConfirmed.set(r.status === 'Confirmed' && r.payment?.status === 'Succeeded');
        this.loading.set(false);

        if (this.hotelPhoto() === null) {
          this.api.getHotel(r.hotelId).subscribe({
            next: (h) => this.hotelPhoto.set((h.images.find((i) => i.isCover) ?? h.images[0])?.url ?? null),
            error: () => undefined,
          });
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toasts.fromError(err, 'That booking could not be loaded.');
      },
    });
  }

  protected cancel(): void {
    if (!confirm('Cancel this booking? Any payment taken will be refunded.')) return;

    this.busy.set(true);

    this.api.cancelReservation(this.id).subscribe({
      next: (r) => {
        this.reservation.set(r);
        this.justConfirmed.set(false);
        this.busy.set(false);
        this.toasts.success('Booking cancelled.');
      },
      error: (err) => {
        this.busy.set(false);
        this.toasts.fromError(err, 'Could not cancel the booking.');
      },
    });
  }

  protected submitReview(): void {
    this.busy.set(true);

    this.api
      .createReview({ reservationId: this.id, rating: this.rating, comment: this.comment || undefined })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toasts.success('Review published. Thank you.');
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.toasts.fromError(err, 'Could not publish the review.');
        },
      });
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
