import { Component, computed, input } from '@angular/core';

/**
 * Line icons on a 24-unit grid, stroked in the current text colour. Kept as
 * path data here rather than an icon font so each one costs a few bytes and
 * nothing is fetched at runtime.
 */
const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 10h16M8.5 3v4M15.5 3v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z',
  bed: 'M3 18V6M3 14h18v4M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5M7 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  building: 'M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M3 21h18M8.5 8h3M8.5 12h3M8.5 16h3',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  sort: 'M4 7h16M7 12h10M10 17h4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a4.8 4.8 0 0 1 6.4 0M12 19.5h.01',
  waves: 'M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2-1.5 4.5-1.5S19 9 21 9M3 14c2 0 2-1.5 4.5-1.5S9.5 14 12 14s2-1.5 4.5-1.5S19 14 21 14M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2-1.5 4.5-1.5S19 19 21 19',
  parking: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM9.5 16.5v-9h3.25a2.75 2.75 0 0 1 0 5.5H9.5',
  coffee: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
  paw: 'M8 7.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM16 7.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM4.5 12a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM19.5 12a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM12 11c-2.8 0-5.5 3.6-5.5 6.2 0 1.6 1.2 2.3 2.6 2.3 1.2 0 1.9-.6 2.9-.6s1.7.6 2.9.6c1.4 0 2.6-.7 2.6-2.3 0-2.6-2.7-6.2-5.5-6.2Z',
  plane: 'M10.5 13.5L3 11l1.5-1.5 7.5 1 4-4.5c1-1 2.6-1.4 3.4-.6s.4 2.4-.6 3.4L14.5 12.5l1 7.5L14 21.5 11.5 14',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  door: 'M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17M14.5 12.5h.01',
  glass: 'M7 3h10l-1 7a4 4 0 0 1-8 0ZM12 14v7M8.5 21h7',
  lock: 'M6.5 11h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  card: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5ZM3.5 10h17M7 15h3',
  shield: 'M12 21s7-3 7-9V5.5L12 3 5 5.5V12c0 6 7 9 7 9ZM9 12l2 2 4-4',
  logout: 'M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  grid: 'M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  key: 'M14.5 9.5a4.5 4.5 0 1 1-1.3-3.2M14.5 9.5L21 16v3.5h-3v-2h-2v-2h-2',
  mail: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5ZM4 7l8 6 8-6',
  phone: 'M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7Z',
  plus: 'M12 5v14M5 12h14',
};

/** Which icon a facility gets, matched on words in its name. */
const AMENITY_ICONS: [RegExp, string][] = [
  [/wi-?fi|internet/i, 'wifi'],
  [/pool|swim/i, 'waves'],
  [/park/i, 'parking'],
  [/breakfast|coffee|restaurant/i, 'coffee'],
  [/fitness|gym/i, 'dumbbell'],
  [/pet/i, 'paw'],
  [/airport|shuttle/i, 'plane'],
  [/air con|conditioning/i, 'snow'],
  [/view|sea/i, 'sun'],
  [/balcony|terrace/i, 'door'],
  [/minibar|bar/i, 'glass'],
  [/safe/i, 'lock'],
];

export function amenityIcon(name: string): string {
  return AMENITY_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? 'check';
}

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" [attr.fill]="filled() ? 'currentColor' : 'none'" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: 0 0 auto;
        line-height: 0;
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number | string>(18);
  readonly stroke = input(1.6);
  readonly filled = input(false);

  protected readonly path = computed(() => PATHS[this.name()] ?? PATHS['check']);
}
