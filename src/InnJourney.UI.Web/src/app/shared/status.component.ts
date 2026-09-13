import { Component, computed, input } from '@angular/core';

/** Renders a reservation or payment status as a labelled chip. */
@Component({
  selector: 'app-status',
  standalone: true,
  template: `<span class="status" [class]="'status status--' + key()">{{ label() }}</span>`,
})
export class StatusComponent {
  readonly value = input.required<string>();

  protected readonly key = computed(() => this.value().toLowerCase());

  protected readonly label = computed(() => {
    // Written for a guest reading them, not for the enum they come from.
    const wording: Record<string, string> = {
      Pending: 'Awaiting payment',
      Confirmed: 'Confirmed',
      CheckedIn: 'Checked in',
      CheckedOut: 'Stay complete',
      Cancelled: 'Cancelled',
      Succeeded: 'Paid',
      Failed: 'Declined',
      Refunded: 'Refunded',
    };

    return wording[this.value()] ?? this.value();
  });
}
