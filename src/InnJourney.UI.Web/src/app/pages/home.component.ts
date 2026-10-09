import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { addDays, formatDate, today } from '../core/dates';
import { HotelSummary } from '../core/models';
import { CITY_PHOTOS, HERO_PHOTO, HOST_PHOTO, STORY_PHOTOS, unsplash } from '../core/photos';
import { IconComponent } from '../shared/icon.component';
import { RibbonComponent } from '../shared/ribbon.component';
import { SearchBarComponent, StaySearch } from '../shared/search-bar.component';
import { StayCardComponent } from '../shared/stay-card.component';

interface CityTile {
  name: string;
  country: string;
  photo: string | null;
  count: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, IconComponent, RibbonComponent, SearchBarComponent, StayCardComponent],
  template: `
    <section class="page--wide hero-wrap">
      <div class="hero" [style.background-image]="'url(' + heroPhoto + ')'">
        <div class="hero__inner">
          <h1 class="hero__title">Find a room for exactly the nights you need</h1>
          <p class="hero__lede">
            Every room is checked across your whole stay, so one that frees up the
            morning you arrive shows as free.
          </p>
        </div>

        <app-search-bar class="hero__search" [raised]="true" cta="Search" (searched)="search($event)" />
      </div>
    </section>

    @if (cities().length > 0) {
      <section class="page--wide block">
        <div class="section-head">
          <h2>Popular locations</h2>

          <div class="arrows">
            <button type="button" class="arrow" (click)="scroll(cityRow, -1)">
              <app-icon name="chevron-left" />
              <span class="visually-hidden">Previous locations</span>
            </button>
            <button type="button" class="arrow" (click)="scroll(cityRow, 1)">
              <app-icon name="chevron-right" />
              <span class="visually-hidden">More locations</span>
            </button>
          </div>
        </div>

        <div class="rail rail--cities" #cityRow>
          @for (city of cities(); track city.name) {
            <a class="city" [routerLink]="['/search']" [queryParams]="{ city: city.name }">
              @if (city.photo) {
                <img [src]="city.photo" alt="" loading="lazy" />
              }
              <span class="city__label">
                <strong>{{ city.name }}, {{ city.country }}</strong>
                <span>{{ city.count }} {{ city.count === 1 ? 'property' : 'properties' }}</span>
              </span>
            </a>
          }
        </div>
      </section>
    }

    <section class="story-band">
      <div class="page--wide story">
        <div class="story__media">
          <img class="story__photo story__photo--main" [src]="storyPhotos[0]" alt="" loading="lazy" />
          <img class="story__photo story__photo--inset" [src]="storyPhotos[1]" alt="" loading="lazy" />

          <figure class="turnover card">
            <figcaption>
              <strong>Room 204</strong>
              <span class="muted">{{ fmt(demo.from) }} to {{ fmt(demo.to) }}</span>
            </figcaption>
            <app-ribbon
              [from]="demo.from"
              [to]="demo.to"
              [occupied]="demo.occupied"
              [selectedFrom]="demo.selectedFrom"
              [selectedTo]="demo.selectedTo"
              [showScale]="false"
            />
            <p class="turnover__key">
              <span><i class="key key--taken"></i>Booked</span>
              <span><i class="key key--yours"></i>Your stay</span>
            </p>
          </figure>
        </div>

        <div class="story__text">
          <p class="eyebrow">Nights, not dates</p>
          <h2>The day one guest leaves is a day the next one can arrive</h2>
          <p class="muted">
            A stay runs from the evening you check in to the morning you check out.
            Inn Journey books rooms on exactly that rule, so a room that looks taken is
            often free for the span you wanted &mdash; and it is shown as free.
          </p>

          <ul class="ticks">
            <li><app-icon name="check" [stroke]="2" /> Availability worked out for every night of the stay</li>
            <li><app-icon name="check" [stroke]="2" /> Prices per night, with a child rate for every room</li>
            <li><app-icon name="check" [stroke]="2" /> The room is held while you pay, then confirmed</li>
          </ul>

          <a routerLink="/search" class="btn btn--pill">
            Browse stays
            <app-icon name="chevron-right" [size]="16" [stroke]="2" />
          </a>
        </div>
      </div>
    </section>

    @if (featured().length > 0) {
      <section class="page--wide block">
        <div class="section-head">
          <h2>Popular stays for your next trip</h2>
          <a routerLink="/search" class="see-all">
            See all stays
            <app-icon name="chevron-right" [size]="16" />
          </a>
        </div>

        <div class="stays-wrap">
          <button type="button" class="arrow arrow--float arrow--left" (click)="scroll(stayRow, -1)">
            <app-icon name="chevron-left" />
            <span class="visually-hidden">Previous stays</span>
          </button>

          <div class="rail rail--stays" #stayRow>
            @for (hotel of featured(); track hotel.id) {
              <app-stay-card [hotel]="hotel" [nights]="3" />
            }
          </div>

          <button type="button" class="arrow arrow--float arrow--right" (click)="scroll(stayRow, 1)">
            <app-icon name="chevron-right" />
            <span class="visually-hidden">More stays</span>
          </button>
        </div>
      </section>
    }

    <section class="page--wide block">
      <div class="host" [style.background-image]="'url(' + hostPhoto + ')'">
        <div class="host__inner">
          <p class="host__eyebrow">For property owners</p>
          <h2>Let your rooms, and see every night of them on one board</h2>
          <p>
            Add rooms and rates, watch occupancy across the month, and check guests in and
            out as they arrive.
          </p>
          <a routerLink="/register" class="btn btn--pill btn--lg host__cta">List a property</a>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      /* --- Hero -------------------------------------------------------------- */

      .hero-wrap {
        padding-top: var(--s5);
      }

      .hero {
        position: relative;
        border-radius: var(--radius-xl);
        background-size: cover;
        background-position: center 60%;
        padding: clamp(4rem, 9vw, 7.5rem) clamp(1rem, 4vw, 3.5rem) clamp(2rem, 4vw, 3rem);
        isolation: isolate;
        overflow: hidden;
      }

      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
          linear-gradient(180deg, rgb(10 14 30 / 55%) 0%, rgb(10 14 30 / 25%) 45%, rgb(10 14 30 / 55%) 100%);
      }

      .hero__inner {
        max-width: 46rem;
        margin: 0 auto;
        text-align: center;
        color: #fff;
      }

      .hero__title {
        color: #fff;
        font-size: clamp(2.1rem, 1.3rem + 3.4vw, 3.6rem);
        font-weight: 600;
        letter-spacing: -0.035em;
        line-height: 1.08;
        margin: 0 auto var(--s4);
        max-width: 18ch;
        text-wrap: balance;
      }

      .hero__lede {
        font-size: clamp(1rem, 0.95rem + 0.3vw, 1.12rem);
        color: rgb(255 255 255 / 88%);
        max-width: 44ch;
        margin: 0 auto;
      }

      .hero__search {
        max-width: 64rem;
        margin: clamp(2.5rem, 6vw, 4.5rem) auto 0;
      }

      /* --- Blocks ------------------------------------------------------------- */

      .block {
        padding-top: var(--s8);
      }

      .see-all {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        font-size: 0.92rem;
        text-decoration: none;
      }

      .arrows {
        display: flex;
        gap: var(--s2);
      }

      .arrow {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }

      .arrow:hover {
        border-color: var(--line-strong);
        box-shadow: var(--shadow);
      }

      /* A row that scrolls sideways inside itself, snapping card to card. */
      .rail {
        display: grid;
        grid-auto-flow: column;
        gap: var(--s5);
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        padding-bottom: var(--s2);
      }

      .rail::-webkit-scrollbar {
        display: none;
      }

      .rail > * {
        scroll-snap-align: start;
      }

      .rail--cities {
        grid-auto-columns: minmax(15rem, calc((100% - 3 * var(--s5)) / 4));
      }

      .rail--stays {
        grid-auto-columns: minmax(17rem, calc((100% - 2 * var(--s5)) / 3));
        padding: var(--s2) 0;
      }

      .city {
        position: relative;
        display: block;
        aspect-ratio: 4 / 3.6;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: linear-gradient(150deg, #2b2457, #6941e5);
        text-decoration: none;
      }

      .city img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 400ms ease;
      }

      .city:hover img {
        transform: scale(1.04);
      }

      .city::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgb(8 10 24 / 70%), transparent 55%);
      }

      .city__label {
        position: absolute;
        left: var(--s4);
        right: var(--s4);
        bottom: var(--s4);
        z-index: 1;
        display: flex;
        flex-direction: column;
        color: #fff;
        line-height: 1.3;
      }

      .city__label strong {
        font-size: 1.05rem;
        font-weight: 600;
      }

      .city__label span {
        font-size: 0.84rem;
        color: rgb(255 255 255 / 80%);
      }

      /* --- Story -------------------------------------------------------------- */

      .story-band {
        margin-top: var(--s8);
        padding: var(--s8) 0;
        background: var(--band);
      }

      .story {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
        gap: clamp(2rem, 6vw, 5rem);
        align-items: center;
      }

      .story__media {
        position: relative;
        padding: 0 var(--s7) var(--s8) 0;
      }

      .story__photo {
        border-radius: var(--radius-lg);
        object-fit: cover;
        width: 100%;
      }

      .story__photo--main {
        aspect-ratio: 4 / 3;
      }

      .story__photo--inset {
        position: absolute;
        right: 0;
        top: 12%;
        width: 34%;
        aspect-ratio: 3 / 4;
        border: 5px solid var(--band);
        box-shadow: var(--shadow-lift);
      }

      .turnover {
        position: absolute;
        left: 6%;
        right: 16%;
        bottom: var(--s2);
        margin: 0;
        padding: var(--s4);
        box-shadow: var(--shadow-lift);
        border-color: transparent;
      }

      .turnover figcaption {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--s3);
        font-size: 0.86rem;
        margin-bottom: var(--s3);
      }

      .turnover__key {
        display: flex;
        gap: var(--s4);
        margin: var(--s3) 0 0;
        font-size: 0.78rem;
        color: var(--ink-soft);
      }

      .turnover__key span {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .key {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 2px;
        display: inline-block;
      }

      .key--taken {
        background: var(--lamp);
      }

      .key--yours {
        background: var(--pool-soft);
        box-shadow: inset 0 0 0 2px var(--pool);
      }

      .story__text h2 {
        font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.3rem);
        letter-spacing: -0.03em;
        max-width: 20ch;
      }

      .ticks {
        list-style: none;
        padding: 0;
        margin: var(--s5) 0 var(--s6);
        display: grid;
        gap: var(--s3);
      }

      .ticks li {
        display: flex;
        align-items: center;
        gap: var(--s3);
        font-size: 0.95rem;
      }

      .ticks app-icon {
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        background: var(--pool-soft);
        color: var(--pool);
        align-items: center;
        justify-content: center;
      }

      /* --- Stays rail ---------------------------------------------------------- */

      .stays-wrap {
        position: relative;
      }

      .arrow--float {
        position: absolute;
        top: 38%;
        z-index: 2;
        box-shadow: var(--shadow);
      }

      .arrow--left {
        left: -1.25rem;
      }

      .arrow--right {
        right: -1.25rem;
      }

      /* --- Host band ------------------------------------------------------------ */

      .host {
        position: relative;
        border-radius: var(--radius-xl);
        overflow: hidden;
        background-size: cover;
        background-position: center;
        isolation: isolate;
        padding: clamp(3rem, 8vw, 6rem) var(--s5);
        text-align: center;
      }

      .host::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: linear-gradient(180deg, rgb(12 16 34 / 62%), rgb(12 16 34 / 72%));
      }

      .host__inner {
        max-width: 38rem;
        margin: 0 auto;
        color: rgb(255 255 255 / 88%);
      }

      .host__eyebrow {
        font-size: 0.85rem;
        font-weight: 600;
        color: #d9ceff;
        margin-bottom: var(--s3);
      }

      .host h2 {
        color: #fff;
        font-size: clamp(1.6rem, 1.2rem + 1.6vw, 2.4rem);
        letter-spacing: -0.03em;
        text-wrap: balance;
      }

      .host__cta {
        margin-top: var(--s3);
      }

      @media (max-width: 1340px) {
        .arrow--left {
          left: 0.5rem;
        }

        .arrow--right {
          right: 0.5rem;
        }
      }

      @media (max-width: 900px) {
        .story {
          grid-template-columns: 1fr;
        }

        .story__media {
          padding-right: var(--s5);
        }
      }

      @media (max-width: 600px) {
        .hero {
          padding-top: var(--s7);
        }

        .arrow--float {
          display: none;
        }

        .turnover {
          left: 0;
          right: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .city:hover img {
          transform: none;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly heroPhoto = unsplash(HERO_PHOTO, 2000);
  protected readonly hostPhoto = unsplash(HOST_PHOTO, 2000);
  protected readonly storyPhotos = STORY_PHOTOS.map((id) => unsplash(id, 1000));

  protected readonly fmt = (iso: string) => formatDate(iso, false);

  /**
   * An illustrative fortnight in one room: a guest leaves on the morning of the
   * sixth night, and your stay begins that same evening.
   */
  private readonly demoStart = addDays(today(), 7);
  protected readonly demo = {
    from: this.demoStart,
    to: addDays(this.demoStart, 14),
    occupied: [0, 1, 2, 3, 4, 10, 11, 12].map((d) => addDays(this.demoStart, d)),
    selectedFrom: addDays(this.demoStart, 5),
    selectedTo: addDays(this.demoStart, 9),
  };

  protected readonly featured = signal<HotelSummary[]>([]);

  /** Cities the catalogue actually covers, rather than a list written by hand. */
  protected readonly cities = computed<CityTile[]>(() => {
    const tiles = new Map<string, CityTile>();

    for (const hotel of this.featured()) {
      const name = hotel.address.city;
      const existing = tiles.get(name);

      if (existing) {
        existing.count++;
        continue;
      }

      const known = CITY_PHOTOS[name.toLowerCase()];

      tiles.set(name, {
        name,
        country: hotel.address.country,
        photo: known ? unsplash(known, 900) : hotel.coverImageUrl,
        count: 1,
      });
    }

    return [...tiles.values()];
  });

  ngOnInit(): void {
    // The landing page is useful without this, so a failure here stays quiet and
    // the sections that depend on it simply do not render.
    this.api.searchHotels({ page: 1, pageSize: 12 }).subscribe({
      next: (result) => this.featured.set(result.items),
      error: () => this.featured.set([]),
    });
  }

  protected scroll(row: HTMLElement, direction: 1 | -1): void {
    row.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: 'smooth' });
  }

  protected search(query: StaySearch): void {
    void this.router.navigate(['/search'], {
      queryParams: {
        city: query.city || null,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        guests: query.guests,
      },
    });
  }
}
