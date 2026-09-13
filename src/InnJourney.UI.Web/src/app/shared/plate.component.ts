import { Component, computed, input } from '@angular/core';

import { RibbonComponent } from './ribbon.component';

/** Six deep, desaturated grounds. Every one of them lets --lamp read as amber. */
const GROUNDS: readonly { from: string; to: string; glow: string }[] = [
  { from: '#0b1f2a', to: '#17414a', glow: '#2e6e73' },
  { from: '#12261c', to: '#24503a', glow: '#2f7350' },
  { from: '#241726', to: '#4a2d47', glow: '#6d4166' },
  { from: '#2a1a14', to: '#55332a', glow: '#7d4a38' },
  { from: '#121c2e', to: '#2b3d63', glow: '#3d5688' },
  { from: '#1d2113', to: '#3f4526', glow: '#5c6436' },
];

/**
 * The plate: what a card shows where a travel site would show a photograph.
 *
 * This product sells nights rather than places, so the image slot carries the
 * nights — a ground chosen from the property's own name, with the occupancy
 * ribbon riding across it. The result is stable per property (the same hotel is
 * always the same colour), needs no asset pipeline, and degrades to the real
 * photograph the moment one exists.
 */
@Component({
  selector: 'app-plate',
  standalone: true,
  imports: [RibbonComponent],
  template: `
    <div class="plate" [style.background]="background()">
      @if (src(); as image) {
        <img class="plate__photo" [src]="image" [alt]="alt()" loading="lazy" />
      } @else if (monogram()) {
        <span class="plate__mark num" aria-hidden="true">{{ monogram() }}</span>
      }

      <div class="plate__chips">
        <ng-content />
      </div>

      @if (from() && to()) {
        <div class="plate__ribbon">
          <app-ribbon
            [from]="from()!"
            [to]="to()!"
            [occupied]="occupied()"
            [selectedFrom]="selectedFrom()"
            [selectedTo]="selectedTo()"
            [showScale]="false"
            tone="dark"
          />
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .plate {
        position: relative;
        aspect-ratio: 16 / 10;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      /* Sits behind everything, low enough to read as texture rather than a label. */
      .plate__mark {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 3.4rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        color: rgb(255 255 255 / 13%);
        user-select: none;
      }

      .plate__photo {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* Chips need a floor to sit on when the ground behind them is a photo. */
      .plate__chips {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s2);
        padding: var(--s3);
      }

      .plate__ribbon {
        position: relative;
        padding: var(--s3);
        background: linear-gradient(to top, rgb(0 0 0 / 45%), transparent);
      }
    `,
  ],
})
export class PlateComponent {
  /** Anything stable about the property. The same seed always picks the same ground. */
  readonly seed = input('');

  /** A real photograph, when the property has one. It wins over the ground. */
  readonly src = input<string | null>(null);
  readonly alt = input('');

  /** Drawn as a monogram when no photograph exists. */
  readonly label = input('');

  readonly from = input<string | null>(null);
  readonly to = input<string | null>(null);
  readonly occupied = input<string[]>([]);
  readonly selectedFrom = input<string | null>(null);
  readonly selectedTo = input<string | null>(null);

  protected readonly monogram = computed(() =>
    this.label()
      .split(/\s+/)
      .filter((word) => /[a-z0-9]/i.test(word))
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('')
  );

  protected readonly background = computed(() => {
    const seed = this.seed();
    let sum = 0;

    for (let i = 0; i < seed.length; i++) {
      sum = (sum + seed.charCodeAt(i) * (i + 1)) % 4093;
    }

    const g = GROUNDS[sum % GROUNDS.length];

    // A low glow off one shoulder keeps the flat fill from reading as a swatch.
    return (
      `radial-gradient(90% 70% at 18% 8%, ${g.glow}40 0%, transparent 62%), ` +
      `linear-gradient(150deg, ${g.from} 0%, ${g.to} 100%)`
    );
  });
}
