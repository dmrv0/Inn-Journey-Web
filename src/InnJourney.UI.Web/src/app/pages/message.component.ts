import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page wrap">
      <p class="eyebrow">{{ code() }}</p>
      <h1>{{ heading() }}</h1>
      <p class="muted lede">{{ body() }}</p>
      <a routerLink="/" class="btn">Back to the start</a>
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: var(--s8) var(--s5);
        max-width: 44rem;
      }

      .lede {
        font-size: 1.05rem;
        margin-bottom: var(--s5);
      }
    `,
  ],
})
export class MessageComponent {
  readonly code = input('');
  readonly heading = input('');
  readonly body = input('');
}

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [MessageComponent],
  template: `
    <app-message
      code="404"
      heading="There's nothing at this address"
      body="The page may have been moved, or the link may be out of date."
    />
  `,
})
export class NotFoundComponent {}

@Component({
  selector: 'app-no-access',
  standalone: true,
  imports: [MessageComponent],
  template: `
    <app-message
      code="403"
      heading="This area isn't yours"
      body="Your account doesn't have access here. If you think it should, ask an administrator to check your roles."
    />
  `,
})
export class NoAccessComponent {}
