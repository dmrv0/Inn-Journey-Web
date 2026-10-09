import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { addDays, formatDate, formatMoney, formatPrice, nightsBetween, today } from '../core/dates';
import { AvailableRoom, HotelDetail, Review } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent, amenityIcon } from '../shared/icon.component';
import { PlateComponent } from '../shared/plate.component';
import { RibbonComponent } from '../shared/ribbon.component';

@Component({
  selector: 'app-hotel',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PlateComponent, RibbonComponent],
  template: `
    @if (loading()) {
      <div class="page--wide pad">
        <div class="skeleton" style="height: 2rem; width: 40%"></div>
        <div class="skeleton" style="height: 26rem; margin-top: 1.5rem; border-radius: 20px"></div>
      </div>
    } @else {
    @if (hotel(); as h) {
      <article class="page--wide pad">
        <a routerLink="/search" class="back">
          <app-icon name="chevron-left" [size]="16" />
          All stays
        </a>

        <header class="head">
          <p class="head__where">
            <app-icon name="pin" [size]="16" />
            {{ h.address.city }}, {{ h.address.country }}
          </p>
          <h1>{{ h.name }}</h1>

          <ul class="head__meta">
            <li>
              <app-icon class="star" name="star" [size]="16" [filled]="true" [stroke]="1" />
              @if (h.reviewCount > 0) {
                <strong class="num">{{ h.averageRating.toFixed(1) }}</strong>
                <button type="button" class="linklike" (click)="jump('reviews')">{{ h.reviewCount }} review{{ h.reviewCount === 1 ? '' : 's' }}</button>
              } @else {
                <span>No reviews yet</span>
              }
            </li>
            <li>
              <app-icon name="building" [size]="16" />
              {{ h.stars }}-star hotel
            </li>
            <li>
              <app-icon name="bed" [size]="16" />
              {{ h.rooms.length }} room{{ h.rooms.length === 1 ? '' : 's' }}
            </li>
          </ul>
        </header>

        @if (h.images.length) {
          <div class="gallery" [class.gallery--single]="h.images.length < 4">
            @for (image of h.images.slice(0, h.images.length < 4 ? 1 : 4); track image.id; let i = $index) {
              <img
                [class]="'gallery__img gallery__img--' + i"
                [src]="image.url"
                [alt]="image.altText || h.name"
                [attr.loading]="i === 0 ? 'eager' : 'lazy'"
              />
            }
            <span class="gallery__count num">{{ h.images.length }} photo{{ h.images.length === 1 ? '' : 's' }}</span>
          </div>
        } @else {
          <div class="gallery gallery--single">
            <app-plate class="gallery__plate" [seed]="h.id" [label]="h.name" />
          </div>
        }

        <div class="layout">
          <div class="main">
            <nav class="tabs" aria-label="On this page">
              @for (tab of tabs; track tab.id) {
                <button type="button" [class.on]="tab.id === activeTab()" (click)="jump(tab.id)">
                  {{ tab.label }}
                </button>
              }
            </nav>

            <section id="overview" class="section">
              <h2>About this place</h2>
              @if (h.description) {
                <p class="lede">{{ h.description }}</p>
              }

              @if (h.amenities.length) {
                <h3 class="sub">What this place offers</h3>
                <ul class="offers">
                  @for (a of h.amenities; track a.id) {
                    <li>
                      <app-icon [name]="icon(a.name)" [size]="20" />
                      {{ a.name }}
                    </li>
                  }
                </ul>
              }
            </section>

            <section id="rooms" class="section">
              <div class="section__head">
                <h2>Rooms</h2>
                <p class="muted num">
                  {{ fmt(checkIn) }} &ndash; {{ fmt(checkOut) }} &middot;
                  {{ nights() }} night{{ nights() === 1 ? '' : 's' }}
                </p>
              </div>

              @if (checkingAvailability()) {
                <div class="skeleton" style="height: 9rem"></div>
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
                          <span class="room__no">Room <span class="num">{{ option.room.number }}</span></span>
                        </h3>

                        <ul class="facts">
                          <li>
                            <app-icon name="users" [size]="16" />
                            Sleeps {{ option.room.capacity }}
                          </li>
                          @for (a of option.room.amenities; track a.id) {
                            <li>
                              <app-icon [name]="icon(a.name)" [size]="16" />
                              {{ a.name }}
                            </li>
                          }
                        </ul>

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
                        <p class="price">
                          <span class="price__night">{{ price(option.room.adultPrice) }}<small>/adult/night</small></span>
                        </p>
                        <p class="room__total num">
                          {{ money(option.totalPrice) }} for {{ option.nights }} night{{ option.nights === 1 ? '' : 's' }}
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

            <section id="reviews" class="section">
              <div class="section__head">
                <h2>What guests said</h2>
                @if (h.reviewCount > 0) {
                  <p class="score">
                    <app-icon class="star" name="star" [size]="18" [filled]="true" [stroke]="1" />
                    <strong class="num">{{ h.averageRating.toFixed(1) }}</strong>
                    <span class="muted">from {{ h.reviewCount }} review{{ h.reviewCount === 1 ? '' : 's' }}</span>
                  </p>
                }
              </div>

              @if (reviews().length === 0) {
                <div class="empty">
                  <h3>No reviews yet</h3>
                  <p>Reviews appear here once a guest has completed a stay.</p>
                </div>
              } @else {
                <ul class="reviews">
                  @for (review of reviews(); track review.id) {
                    <li class="review card">
                      <span class="review__stars" [attr.aria-label]="review.rating + ' out of 5'" role="img">
                        @for (n of [1, 2, 3, 4, 5]; track n) {
                          <app-icon name="star" [size]="15" [filled]="n <= review.rating" [stroke]="1.2" [class.dim]="n > review.rating" />
                        }
                      </span>

                      @if (review.comment) {
                        <p class="review__text">{{ review.comment }}</p>
                      }

                      <div class="review__by">
                        <span class="review__avatar" aria-hidden="true">{{ review.authorName.charAt(0) }}</span>
                        <span>
                          <strong>{{ review.authorName }}</strong>
                          <span class="muted">{{ fmt(review.createdDate) }}</span>
                        </span>
                      </div>

                      @if (review.ownerResponse) {
                        <blockquote class="response">
                          <strong>Reply from {{ h.name }}</strong>
                          {{ review.ownerResponse }}
                        </blockquote>
                      }
                    </li>
                  }
                </ul>
              }
            </section>

            <section id="location" class="section">
              <h2>Where you'll stay</h2>
              <div class="where card">
                <app-icon name="pin" [size]="22" />
                <div>
                  <strong>{{ h.address.line }}</strong>
                  <p class="muted">
                    {{ h.address.city }}@if (h.address.postalCode) { {{ h.address.postalCode }}}, {{ h.address.country }}
                  </p>
                </div>
                @if (h.googleMapsUrl) {
                  <a class="btn btn--ghost btn--sm" [href]="h.googleMapsUrl" target="_blank" rel="noopener">Open in Maps</a>
                }
              </div>

              @if (h.phone || h.email) {
                <ul class="contact">
                  @if (h.phone) {
                    <li><app-icon name="phone" [size]="16" /> {{ h.phone }}</li>
                  }
                  @if (h.email) {
                    <li><app-icon name="mail" [size]="16" /> {{ h.email }}</li>
                  }
                </ul>
              }
            </section>
          </div>

          <aside class="booking card">
            <p class="booking__from">
              @if (fromPrice() !== null) {
                <span class="price__night">{{ price(fromPrice()) }}<small>/night</small></span>
                <span class="muted">from, per adult</span>
              } @else {
                <span class="muted">No rooms listed yet</span>
              }
            </p>

            <form class="booking__form" (ngSubmit)="loadAvailability()">
              <div class="booking__grid">
                <div class="cell">
                  <label for="in">Check-in</label>
                  <input id="in" type="date" [min]="minDate" [(ngModel)]="checkIn" name="in" />
                </div>
                <div class="cell">
                  <label for="out">Check-out</label>
                  <input id="out" type="date" [min]="minOut()" [(ngModel)]="checkOut" name="out" />
                </div>
                <div class="cell">
                  <label for="adults">Adults</label>
                  <input id="adults" type="number" min="1" max="20" [(ngModel)]="adults" name="adults" />
                </div>
                <div class="cell">
                  <label for="children">Children</label>
                  <input id="children" type="number" min="0" max="20" [(ngModel)]="children" name="children" />
                </div>
              </div>

              <button class="btn btn--block btn--lg" type="submit">Check availability</button>
            </form>

            <p class="booking__note muted">
              @if (!checkingAvailability() && available().length > 0) {
                {{ available().length }} room{{ available().length === 1 ? '' : 's' }} free for these nights.
                <button type="button" class="linklike" (click)="jump('rooms')">See rooms</button>
              } @else {
                You won't be charged until you confirm.
              }
            </p>
          </aside>
        </div>
      </article>
    }
    }
  `,
  styles: [
    `
      .pad {
        padding-top: var(--s5);
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

      .back:hover {
        color: var(--ink);
      }

      .head h1 {
        margin-bottom: var(--s2);
      }

      .head__where {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--ink-soft);
        margin: 0 0 var(--s1);
      }

      .head__meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s2) var(--s5);
        list-style: none;
        padding: 0;
        margin: 0 0 var(--s5);
        font-size: 0.92rem;
        color: var(--ink-soft);
      }

      .head__meta li {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .head__meta strong {
        color: var(--ink);
      }

      .linklike {
        background: none;
        border: 0;
        padding: 0;
        color: var(--ink);
        font-size: inherit;
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
      }

      .star {
        color: var(--star);
      }

      /* --- Gallery ------------------------------------------------------------ */

      .gallery {
        position: relative;
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        grid-template-rows: repeat(2, minmax(0, 13rem));
        gap: var(--s2);
        border-radius: var(--radius-xl);
        overflow: hidden;
      }

      .gallery__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .gallery__img--0 {
        grid-row: 1 / span 2;
      }

      .gallery__img--3 {
        grid-column: 2 / span 2;
      }

      .gallery--single {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(0, 26rem);
      }

      .gallery--single .gallery__img--0 {
        grid-row: auto;
      }

      .gallery__plate {
        height: 100%;
      }

      .gallery__count {
        position: absolute;
        right: var(--s4);
        bottom: var(--s4);
        padding: 0.3rem 0.75rem;
        border-radius: var(--radius-pill);
        background: rgb(16 16 30 / 70%);
        color: #fff;
        font-size: 0.8rem;
        font-weight: 500;
      }

      /* --- Layout ------------------------------------------------------------ */

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 22rem;
        gap: clamp(1.5rem, 4vw, 4rem);
        align-items: start;
        padding-top: var(--s6);
      }

      .tabs {
        position: sticky;
        top: var(--nav-h);
        background: var(--surface);
        z-index: 5;
      }

      .section {
        padding-bottom: var(--s6);
        margin-bottom: var(--s6);
        border-bottom: 1px solid var(--line);
        scroll-margin-top: calc(var(--nav-h) + 4rem);
      }

      .section:last-child {
        border-bottom: 0;
      }

      .section h2 {
        font-size: 1.35rem;
      }

      .section__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--s2) var(--s4);
        margin-bottom: var(--s4);
      }

      .section__head h2,
      .section__head p {
        margin: 0;
      }

      .lede {
        color: var(--ink-soft);
        font-size: 1.02rem;
        max-width: 62ch;
      }

      .sub {
        font-size: 1.05rem;
        margin-top: var(--s5);
      }

      .offers {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
        gap: 0;
      }

      .offers li {
        display: flex;
        align-items: center;
        gap: var(--s3);
        padding: var(--s3) 0;
        border-bottom: 1px solid var(--line);
        color: var(--ink);
        margin-right: var(--s5);
      }

      .offers app-icon {
        color: var(--ink-soft);
      }

      /* --- Rooms --------------------------------------------------------------- */

      .rooms {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--s3);
      }

      .room {
        display: flex;
        justify-content: space-between;
        gap: var(--s5);
        padding: var(--s5);
        flex-wrap: wrap;
      }

      .room__main {
        flex: 1 1 18rem;
        min-width: 0;
      }

      .room h3 {
        margin: 0 0 var(--s2);
        display: flex;
        align-items: baseline;
        gap: var(--s2);
        flex-wrap: wrap;
      }

      .room__no {
        font-size: 0.82rem;
        font-weight: 400;
        color: var(--ink-faint);
      }

      .room .facts {
        flex-wrap: wrap;
      }

      .room__ribbon {
        margin-top: var(--s4);
        max-width: 20rem;
      }

      .room__book {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        gap: var(--s1);
        text-align: right;
      }

      .room__book .price {
        margin: 0;
      }

      .room__total {
        margin: 0 0 var(--s2);
        font-size: 0.84rem;
        color: var(--ink-soft);
      }

      /* --- Reviews ------------------------------------------------------------- */

      .score {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .reviews {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
        gap: var(--s4);
      }

      .review {
        padding: var(--s5);
        display: flex;
        flex-direction: column;
        gap: var(--s3);
      }

      .review__stars {
        display: inline-flex;
        gap: 2px;
        color: var(--star);
      }

      .review__stars .dim {
        color: var(--line-strong);
      }

      .review__text {
        margin: 0;
        font-size: 0.95rem;
      }

      .review__by {
        display: flex;
        align-items: center;
        gap: var(--s3);
        margin-top: auto;
        font-size: 0.88rem;
      }

      .review__by > span:last-child {
        display: flex;
        flex-direction: column;
        line-height: 1.35;
      }

      .review__avatar {
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 50%;
        background: var(--pool-soft);
        color: var(--pool-deep);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
      }

      .response {
        margin: 0;
        padding: var(--s3);
        border-radius: var(--radius);
        background: var(--band);
        font-size: 0.88rem;
      }

      .response strong {
        display: block;
        margin-bottom: var(--s1);
      }

      /* --- Location ------------------------------------------------------------ */

      .where {
        display: flex;
        align-items: center;
        gap: var(--s4);
        padding: var(--s4) var(--s5);
        flex-wrap: wrap;
      }

      .where > app-icon {
        color: var(--pool);
      }

      .where > div {
        flex: 1 1 12rem;
      }

      .where p {
        margin: 0;
        font-size: 0.9rem;
      }

      .contact {
        list-style: none;
        padding: 0;
        margin: var(--s4) 0 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s2) var(--s5);
        font-size: 0.9rem;
        color: var(--ink-soft);
      }

      .contact li {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      /* --- Booking card --------------------------------------------------------- */

      .booking {
        position: sticky;
        top: calc(var(--nav-h) + var(--s4));
        padding: var(--s5);
        box-shadow: var(--shadow-lift);
        border-color: transparent;
      }

      .booking__from {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--s3);
        margin-bottom: var(--s4);
        font-size: 0.86rem;
      }

      .booking__from .price__night {
        font-size: 1.45rem;
      }

      .booking__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius);
        overflow: hidden;
        margin-bottom: var(--s4);
      }

      .cell {
        padding: 0.6rem 0.8rem;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .cell:nth-child(odd) {
        border-right: 1px solid var(--line-strong);
      }

      .cell:nth-child(-n + 2) {
        border-bottom: 1px solid var(--line-strong);
      }

      .cell:focus-within {
        background: var(--band);
      }

      .cell label {
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--ink-soft);
      }

      .cell input {
        border: 0;
        padding: 0;
        background: transparent;
        font-size: 0.94rem;
        min-width: 0;
        width: 100%;
        font-variant-numeric: tabular-nums;
      }

      .cell input:focus {
        outline: none;
      }

      .booking__note {
        margin: var(--s4) 0 0;
        font-size: 0.85rem;
        text-align: center;
      }

      @media (max-width: 960px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .booking {
          position: static;
          order: -1;
        }
      }

      @media (max-width: 700px) {
        .gallery {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 15rem 7rem;
          border-radius: var(--radius-lg);
        }

        .gallery__img--0 {
          grid-row: auto;
          grid-column: 1 / -1;
        }

        .gallery__img--3 {
          display: none;
        }

        .room__book {
          align-items: flex-start;
          text-align: left;
        }
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

  /** Recomputed on each availability check, so it reflects the dates last asked about. */
  protected readonly nights = signal(nightsBetween(this.checkIn, this.checkOut));

  protected readonly fromPrice = computed(() => {
    const rooms = this.hotel()?.rooms ?? [];
    return rooms.length ? Math.min(...rooms.map((r) => r.adultPrice)) : null;
  });

  protected readonly tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'location', label: 'Location' },
  ];
  protected readonly activeTab = signal('overview');

  protected readonly fmt = formatDate;
  protected readonly icon = amenityIcon;
  protected readonly price = formatPrice;

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

  /** In-page links scroll rather than navigate: a bare #fragment resolves against the base href. */
  protected jump(id: string): void {
    this.activeTab.set(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected minOut(): string {
    return addDays(this.checkIn, 1);
  }

  protected loadAvailability(): void {
    if (this.checkOut <= this.checkIn) {
      this.checkOut = addDays(this.checkIn, 1);
    }

    this.nights.set(nightsBetween(this.checkIn, this.checkOut));
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
