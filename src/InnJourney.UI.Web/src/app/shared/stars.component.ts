import { Component, computed, input } from '@angular/core';

/**
 * A property's official classification, 1 to 5. Distinct from the guest rating,
 * which is a number rather than a row of marks.
 */
@Component({
  selector: 'app-stars',
  standalone: true,
  template: `
    <span class="stars" [attr.aria-label]="label()" role="img">
      @for (filled of marks(); track $index) {
        <span class="star" [class.star--on]="filled" aria-hidden="true"></span>
      }
    </span>
  `,
  styles: [
    `
      .stars {
        display: inline-flex;
        gap: 2px;
        align-items: center;
      }

      /* Small squares rather than star glyphs: they sit on the same grid as the
         ribbon cells, so a card reads as one system. */
      .star {
        width: 6px;
        height: 6px;
        border-radius: 1px;
        background: var(--line);
      }

      .star--on {
        background: var(--lamp);
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
