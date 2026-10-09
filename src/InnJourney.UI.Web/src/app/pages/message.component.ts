import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page wrap">
      <p class="code-mark">{{ code() }}</p>
      <h1>{{ heading() }}</h1>
      <p class="muted lede">{{ body() }}</p>
      <div class="buttons">
        <a routerLink="/" class="btn btn--pill">Back to the start</a>
        <a routerLink="/search" class="btn btn--ghost btn--pill">Find a stay</a>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        padding-top: var(--s8);
        padding-bottom: var(--s8);
        max-width: 40rem;
        text-align: center;
      }

      .code-mark {
        font-size: clamp(4rem, 3rem + 5vw, 7rem);
        font-weight: 700;
        letter-spacing: -0.05em;
        line-height: 1;
        color: var(--pool);
        margin-bottom: var(--s4);
      }

      .buttons {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: var(--s3);
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
