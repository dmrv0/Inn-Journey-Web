import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { addDays, formatDate, formatMoney, nightsBetween, today } from '../core/dates';
import { AvailableRoom, HotelDetail, Review } from '../core/models';
import { ToastService } from '../core/toast.service';
import { RibbonComponent } from '../shared/ribbon.component';
import { StarsComponent } from '../shared/stars.component';

@Component({
  selector: 'app-hotel',
  standalone: true,
  imports: [FormsModule, RouterLink, RibbonComponent, StarsComponent],
  template: `
    @if (loading()) {
      <div class="page pad">
        <div class="skeleton" style="height: 2.4rem; width: 50%"></div>
        <div class="skeleton" style="height: 18rem; margin-top: 1.5rem"></div>
      </div>
    } @else {
    @if (hotel(); as h) {
      <article>
        <header class="page pad head">
          <div class="head__text">
            <p class="eyebrow">{{ h.address.city }}, {{ h.address.country }}</p>
            <h1>{{ h.name }}</h1>

            <div class="head__meta">
              <app-stars [value]="h.stars" />
              @if (h.reviewCount > 0) {
                <span class="score num">{{ h.averageRating.toFixed(1) }}</span>
                <span class="muted small">{{ h.reviewCount }} review{{ h.reviewCount === 1 ? '' : 's' }}</span>
              } @else {
                <span class="muted small">No reviews yet</span>
              }
            </div>

            @if (h.description) {
              <p class="lede">{{ h.description }}</p>
            }

            <p class="muted small">{{ h.address.line }}, {{ h.address.city }}</p>
          </div>

          @if (h.images.length) {
            <div class="gallery">
              @for (image of h.images.slice(0, 4); track image.id) {
                <img [src]="image.url" [alt]="image.altText || h.name" loading="lazy" />
              }
            </div>
          }
        </header>

        @if (h.amenities.length) {
          <section class="page pad">
            <h2 class="section-title">Facilities</h2>
            <ul class="chips">
              @for (a of h.amenities; track a.id) {
                <li class="tag">{{ a.name }}</li>
              }
            </ul>
          </section>
        }

        <section class="page pad">
          <h2 class="section-title">Rooms</h2>

          <form class="span" (ngSubmit)="loadAvailability()">
            <div class="field">
              <label for="in">Check in</label>
              <input id="in" class="input input--num" type="date" [min]="minDate" [(ngModel)]="checkIn" name="in" />
            </div>
            <div class="field">
              <label for="out">Check out</label>
              <input id="out" class="input input--num" type="date" [min]="minOut()" [(ngModel)]="checkOut" name="out" />
            </div>
            <div class="field narrow">
              <label for="adults">Adults</label>
              <input id="adults" class="input input--num" type="number" min="1" max="20" [(ngModel)]="adults" name="adults" />
            </div>
            <div class="field narrow">
              <label for="children">Children</label>
              <input id="children" class="input input--num" type="number" min="0" max="20" [(ngModel)]="children" name="children" />
            </div>
            <button class="btn" type="submit">Check these nights</button>
          </form>

          <p class="muted small num">
            {{ nights() }} night{{ nights() === 1 ? '' : 's' }} &middot;
            {{ formatDate(checkIn) }} &rarr; {{ formatDate(checkOut) }}
          </p>

          @if (checkingAvailability()) {
            <div class="skeleton" style="height: 8rem; margin-top: 1rem"></div>
          } @else if (available().length === 0) {
            <div class="empty">
              <h3>No rooms free for those nights</h3>
              <p>Try a shorter stay, fewer guests, or different dates.</p>
            </div>
          } @else {
            <ul class="rooms">
              @for (option of available(); track option.room.id) {
                <li class="room card">
                  <div class="room__main">
                    <h3>
                      {{ option.room.roomType?.name || 'Room' }}
                      <span class="room__no num">no. {{ option.room.number }}</span>
                    </h3>

                    <p class="muted small">
                      Sleeps {{ option.room.capacity }} &middot;
                      <span class="num">{{ money(option.room.adultPrice) }}</span> per adult per night
                    </p>

                    @if (option.room.amenities.length) {
                      <ul class="chips chips--tight">
                        @for (a of option.room.amenities; track a.id) {
                          <li class="tag">{{ a.name }}</li>
                        }
                      </ul>
                    }

                    <app-ribbon
                      class="room__ribbon"
                      [from]="checkIn"
                      [to]="checkOut"
                      [selectedFrom]="checkIn"
                      [selectedTo]="checkOut"
                      [showScale]="false"
                      [compact]="true"
                    />
                  </div>

                  <div class="room__book">
                    <p class="room__total">
                      <span class="num">{{ money(option.totalPrice) }}</span>
                      <span class="muted small">total for {{ option.nights }} night{{ option.nights === 1 ? '' : 's' }}</span>
                    </p>

                    <a
                      class="btn"
                      [routerLink]="['/book', option.room.id]"
                      [queryParams]="{ checkIn, checkOut, adults, children }"
                    >
                      Reserve
                    </a>
                  </div>
                </li>
              }
            </ul>
          }
        </section>

        <section class="page pad">
          <h2 class="section-title">What guests said</h2>

          @if (reviews().length === 0) {
            <div class="empty">
              <h3>No reviews yet</h3>
              <p>Reviews appear here once a guest has completed a stay.</p>
            </div>
          } @else {
            <ul class="reviews">
              @for (review of reviews(); track review.id) {
                <li class="review">
                  <div class="review__head">
                    <strong>{{ review.authorName }}</strong>
                    <span class="review__rating num">{{ review.rating }}/5</span>
                    <span class="muted small">{{ formatDate(review.createdDate) }}</span>
                  </div>

                  @if (review.comment) {
                    <p>{{ review.comment }}</p>
                  }

                  @if (review.ownerResponse) {
                    <blockquote class="response">
                      <span class="eyebrow">Reply from {{ h.name }}</span>
                      {{ review.ownerResponse }}
                    </blockquote>
                  }
                </li>
              }
            </ul>
          }
        </section>
      </article>
    }
    }
  `,
  styles: [
    `
      .pad {
        padding-top: var(--s6);
      }

      .head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--s6);
        align-items: start;
      }

      @media (max-width: 860px) {
        .head {
          grid-template-columns: 1fr;
        }
      }

      .head__meta {
        display: flex;
        align-items: baseline;
        gap: var(--s3);
        margin-bottom: var(--s4);
      }

      .score {
        font-size: 1.3rem;
        font-weight: 600;
        color: var(--pool);
      }

      .lede {
        font-size: 1.02rem;
      }

      .gallery {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: var(--s2);
      }

      .gallery img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: var(--radius);
        aspect-ratio: 4 / 3;
      }

      .gallery img:first-child {
        grid-row: span 2;
        aspect-ratio: 1;
      }

      .section-title {
        font-size: 1.2rem;
        border-top: 2px solid var(--line);
        padding-top: var(--s3);
      }

      .chips {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s2);
        padding: 0;
        margin: 0 0 var(--s4);
      }

      .chips--tight {
        margin: var(--s2) 0;
      }

      .span {
        display: flex;
        gap: var(--s3);
        align-items: flex-end;
        flex-wrap: wrap;
        padding: var(--s4);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        margin-bottom: var(--s3);
      }

      .span .field {
        margin: 0;
        flex: 1 1 9rem;
      }

      .span .narrow {
        flex: 0 1 6rem;
      }

      .rooms {
        list-style: none;
        padding: 0;
        margin: var(--s4) 0 0;
        display: grid;
        gap: var(--s3);
      }

      .room {
        display: flex;
        justify-content: space-between;
        gap: var(--s5);
        padding: var(--s4);
        flex-wrap: wrap;
      }

      .room__main {
        flex: 1 1 20rem;
        min-width: 0;
      }

      .room h3 {
        margin: 0 0 var(--s1);
        display: flex;
        align-items: baseline;
        gap: var(--s2);
        flex-wrap: wrap;
      }

      .room__no {
        font-size: 0.8rem;
        font-weight: 400;
        color: var(--ink-faint);
      }

      .room__ribbon {
        margin-top: var(--s3);
        max-width: 22rem;
      }

      .room__book {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        gap: var(--s2);
        text-align: right;
      }

      .room__total {
        margin: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .room__total .num {
        font-size: 1.3rem;
        font-weight: 600;
      }

      .small {
        font-size: 0.85rem;
      }

      .reviews {
        list-style: none;
        padding: 0;
        margin: var(--s4) 0 0;
        display: grid;
        gap: var(--s4);
      }

      .review {
        padding-bottom: var(--s4);
        border-bottom: 1px solid var(--line);
      }

      .review__head {
        display: flex;
        align-items: baseline;
        gap: var(--s3);
        margin-bottom: var(--s2);
        flex-wrap: wrap;
      }

      .review__rating {
        color: var(--lamp);
        font-weight: 600;
      }

      .response {
        margin: var(--s3) 0 0;
        padding: var(--s3);
        border-left: 3px solid var(--pool);
        background: var(--pool-soft);
        font-size: 0.92rem;
      }

      .response .eyebrow {
        margin-bottom: var(--s1);
      }
    `,
  ],
})
export class HotelComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly minDate = today();

  protected checkIn = addDays(today(), 14);
  protected checkOut = addDays(today(), 17);
  protected adults = 2;
  protected children = 0;

  protected readonly hotel = signal<HotelDetail | null>(null);
  protected readonly available = signal<AvailableRoom[]>([]);
  protected readonly reviews = signal<Review[]>([]);
  protected readonly loading = signal(true);
  protected readonly checkingAvailability = signal(false);

  protected readonly nights = computed(() => nightsBetween(this.checkIn, this.checkOut));

  protected readonly formatDate = formatDate;

  private hotelId = '';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    this.checkIn = params.get('checkIn') || this.checkIn;
    this.checkOut = params.get('checkOut') || this.checkOut;
    this.adults = Number(params.get('guests') ?? params.get('adults') ?? this.adults);
    this.children = Number(params.get('children') ?? 0);

    this.hotelId = this.route.snapshot.paramMap.get('id') ?? '';

    this.api.getHotel(this.hotelId).subscribe({
      next: (hotel) => {
        this.hotel.set(hotel);
        this.loading.set(false);
        this.loadAvailability();
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate(['/not-found'], { skipLocationChange: true });
        this.toasts.error('That property could not be found.');
      },
    });

    this.api.hotelReviews(this.hotelId).subscribe({
      next: (page) => this.reviews.set(page.items),
      error: () => undefined,
    });
  }

  protected minOut(): string {
    return addDays(this.checkIn, 1);
  }

  protected loadAvailability(): void {
    if (this.checkOut <= this.checkIn) {
      this.checkOut = addDays(this.checkIn, 1);
    }

    this.checkingAvailability.set(true);

    this.api
      .getAvailability(this.hotelId, this.checkIn, this.checkOut, this.adults, this.children)
      .subscribe({
        next: (rooms) => {
          this.available.set(rooms);
          this.checkingAvailability.set(false);
        },
        error: (err) => {
          this.toasts.fromError(err, 'Could not check availability.');
          this.available.set([]);
          this.checkingAvailability.set(false);
        },
      });
  }

  protected money(value: number): string {
    return formatMoney(value);
  }
}
