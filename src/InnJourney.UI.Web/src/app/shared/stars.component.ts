import { Component, computed, input } from '@angular/core';

import { IconComponent } from './icon.component';

/**
 * A property's official classification, 1 to 5. Distinct from the guest rating,
 * which is shown as a number beside a single star.
 */
@Component({
  selector: 'app-stars',
  standalone: true,
  imports: [IconComponent],
  template: `
    <span class="stars" [attr.aria-label]="label()" role="img">
      @for (filled of marks(); track $index) {
        <app-icon
          name="star"
          [size]="13"
          [stroke]="1.2"
          [filled]="filled"
          [class.off]="!filled"
        />
      }
    </span>
  `,
  styles: [
    `
      .stars {
        display: inline-flex;
        gap: 1px;
        align-items: center;
        color: var(--star);
      }

      .off {
        color: var(--line-strong);
      }
    `,
  ],
})
export class StarsComponent {
  readonly value = input.required<number>();

  protected readonly marks = computed(() =>
    Array.from({ length: 5 }, (_, i) => i < this.value())
  );

  protected readonly label = computed(() => `${this.value()} star property`);
}
