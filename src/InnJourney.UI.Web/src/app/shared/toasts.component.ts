import { Component, inject } from '@angular/core';

import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class.toast--error]="toast.kind === 'error'">
          <span>{{ toast.message }}</span>
          <button type="button" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toasts {
        position: fixed;
        bottom: var(--s5);
        right: var(--s5);
        display: flex;
        flex-direction: column;
        gap: var(--s2);
        z-index: 100;
        max-width: min(26rem, calc(100vw - 2rem));
      }

      .toast {
        display: flex;
        align-items: flex-start;
        gap: var(--s3);
        padding: var(--s3) var(--s4);
        background: var(--ink);
        color: #f6f8f4;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        font-size: 0.9rem;
        animation: rise 160ms ease-out;
      }

      .toast--error {
        background: var(--brick);
      }

      .toast button {
        background: none;
        border: 0;
        color: inherit;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0.7;
      }

      .toast button:hover {
        opacity: 1;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }
    `,
  ],
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
