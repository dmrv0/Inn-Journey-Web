import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatPrice } from '../core/dates';
import { HotelSummary } from '../core/models';
import { IconComponent, amenityIcon } from './icon.component';
import { PlateComponent } from './plate.component';

export interface PlateWindow {
  from: string;
  to: string;
  selectedFrom: string;
  selectedTo: string;
}

/** A property in a list: photograph, name, place, facilities, and what it costs. */
@Component({
  selector: 'app-stay-card',
  standalone: true,
  imports: [RouterLink, IconComponent, PlateComponent],
  template: `
    @let h = hotel();

    <article class="stay">
      <div class="stay__media">
        <app-plate
          [seed]="h.id"
          [src]="h.coverImageUrl"
          [alt]="''"
          [label]="h.name"
          [from]="window()?.from ?? null"
          [to]="window()?.to ?? null"
          [selectedFrom]="window()?.selectedFrom ?? null"
          [selectedTo]="window()?.selectedTo ?? null"
        >
          @if (h.reviewCount > 0) {
            <span class="chip">
              {{ h.averageRating.toFixed(1) }}
              <app-icon name="star" [size]="13" [filled]="true" [stroke]="1" />
            </span>
          } @else {
            <span class="chip">New</span>
          }
        </app-plate>
      </div>

      <div class="stay__body">
        <h3 class="stay__title">
          <a [routerLink]="['/hotels', h.id]" [queryParams]="params()">{{ h.name }}</a>
        </h3>
        <p class="stay__where">{{ h.address.line }}, {{ h.address.city }}, {{ h.address.country }}</p>

        <div class="stay__foot">
          <ul class="facts">
            <li>
              <app-icon name="building" [size]="16" />
              {{ h.stars }}-star
            </li>
            @for (a of h.amenities.slice(0, 3); track a.id) {
              <li [title]="a.name">
                <app-icon [name]="icon(a.name)" [size]="16" />
                <span class="visually-hidden">{{ a.name }}</span>
              </li>
            }
          </ul>

          @if (h.fromPrice !== null) {
            <p class="price">
              <span class="price__night">{{ price(h.fromPrice) }}<small>/night</small></span>
              @if (nights() > 0) {
                <span class="price__total">{{ price(h.fromPrice * nights()) }} total</span>
              }
            </p>
          }
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .stay {
        height: 100%;
      }

      .price {
        margin: 0;
      }
    `,
  ],
})
export class StayCardComponent {
  readonly hotel = input.required<HotelSummary>();
  readonly nights = input(0);
  readonly window = input<PlateWindow | null>(null);
  readonly params = input<Record<string, string | number>>({});

  protected readonly icon = amenityIcon;
  protected readonly price = formatPrice;
}
