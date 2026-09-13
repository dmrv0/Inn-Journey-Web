import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

import { ProblemDetails } from './models';

export interface Toast {
  id: number;
  kind: 'ok' | 'error';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.push('ok', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  /**
   * Turns a failed request into something worth reading. The API speaks RFC 7807,
   * so field-level validation messages are preferred over the generic title.
   */
  fromError(error: unknown, fallback = 'Something went wrong. Try again.'): void {
    this.error(describeError(error, fallback));
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string): void {
    const id = this.nextId++;
    this.items.update((list) => [...list, { id, kind, message }]);

    setTimeout(() => this.dismiss(id), kind === 'error' ? 7000 : 4000);
  }
}

export function describeError(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;

  if (error.status === 0) {
    return 'Could not reach the server. Check your connection.';
  }

  const problem = error.error as ProblemDetails | string | null;

  if (typeof problem === 'string' && problem.trim()) return problem;

  if (problem && typeof problem === 'object') {
    const fieldErrors = problem.errors
      ? Object.values(problem.errors).flat().filter(Boolean)
      : [];

    if (fieldErrors.length) return fieldErrors.join(' ');
    if (problem.detail) return problem.detail;
    if (problem.title) return problem.title;
  }

  return fallback;
}

/** Pulls per-field messages out of a validation response, for inline display. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse)) return {};

  const problem = error.error as ProblemDetails | null;
  if (!problem?.errors) return {};

  const result: Record<string, string> = {};

  for (const [field, messages] of Object.entries(problem.errors)) {
    if (!field) continue;
    const key = field.charAt(0).toLowerCase() + field.slice(1);
    result[key] = messages.join(' ');
  }

  return result;
}
