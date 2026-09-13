import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { Amenity, AmenityScope, Role, RoomType, User } from '../core/models';
import { ToastService } from '../core/toast.service';

type Tab = 'users' | 'roomTypes' | 'amenities';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page wrap">
      <header>
        <p class="eyebrow">Administration</p>
        <h1>Catalogues and accounts</h1>
        <p class="muted">
          Room types and facilities are shared across every property, so a filter for
          &ldquo;Sea view&rdquo; means the same thing everywhere.
        </p>
      </header>

      <nav class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === t.key"
            [class.on]="tab() === t.key"
            (click)="setTab(t.key)"
          >
            {{ t.label }}
          </button>
        }
      </nav>

      @switch (tab()) {
        @case ('users') {
          <section>
            <div class="toolbar">
              <div class="field">
                <label for="q">Search</label>
                <input id="q" class="input" [(ngModel)]="query" (keyup.enter)="loadUsers()" placeholder="Name or email" />
              </div>
              <button class="btn btn--sm" type="button" (click)="loadUsers()">Search</button>
            </div>

            @if (users().length === 0) {
              <div class="empty"><h3>No accounts match</h3></div>
            } @else {
              <table class="table">
                <caption class="visually-hidden">User accounts</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Roles</th>
                    <th scope="col">Change</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of users(); track u.id) {
                    <tr>
                      <td>{{ u.fullName }}</td>
                      <td class="num">{{ u.email }}</td>
                      <td>
                        @for (r of u.roles; track r) {
                          <span class="tag">{{ r }}</span>
                        }
                      </td>
                      <td class="roles">
                        @for (r of allRoles; track r) {
                          <label class="check">
                            <input
                              type="checkbox"
                              [checked]="u.roles.includes(r)"
                              (change)="toggleRole(u, r)"
                            />
                            {{ r }}
                          </label>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        @case ('roomTypes') {
          <section>
            <form class="toolbar card" (ngSubmit)="addRoomType()">
              <div class="field">
                <label for="rt-name">Name</label>
                <input id="rt-name" class="input" name="name" [(ngModel)]="roomTypeDraft.name" required />
              </div>
              <div class="field narrow">
                <label for="rt-cap">Sleeps</label>
                <input id="rt-cap" class="input input--num" type="number" min="1" name="cap" [(ngModel)]="roomTypeDraft.defaultCapacity" />
              </div>
              <div class="field">
                <label for="rt-desc">Description</label>
                <input id="rt-desc" class="input" name="desc" [(ngModel)]="roomTypeDraft.description" />
              </div>
              <button class="btn btn--sm" type="submit">Add</button>
            </form>

            <ul class="list">
              @for (t of roomTypes(); track t.id) {
                <li class="row card">
                  <div>
                    <strong>{{ t.name }}</strong>
                    <span class="muted small"> &middot; sleeps <span class="num">{{ t.defaultCapacity }}</span></span>
                    @if (t.description) {
                      <p class="muted small">{{ t.description }}</p>
                    }
                  </div>
                  <button class="btn btn--ghost btn--sm" type="button" (click)="removeRoomType(t)">Remove</button>
                </li>
              }
            </ul>
          </section>
        }

        @case ('amenities') {
          <section>
            <form class="toolbar card" (ngSubmit)="addAmenity()">
              <div class="field">
                <label for="am-name">Name</label>
                <input id="am-name" class="input" name="name" [(ngModel)]="amenityDraft.name" required />
              </div>
              <div class="field narrow">
                <label for="am-scope">Applies to</label>
                <select id="am-scope" class="input" name="scope" [(ngModel)]="amenityDraft.scope">
                  <option value="Hotel">Property</option>
                  <option value="Room">Room</option>
                </select>
              </div>
              <button class="btn btn--sm" type="submit">Add</button>
            </form>

            <ul class="list">
              @for (a of amenities(); track a.id) {
                <li class="row card">
                  <div>
                    <strong>{{ a.name }}</strong>
                    <span class="tag">{{ a.scope === 'Hotel' ? 'Property' : 'Room' }}</span>
                  </div>
                  <button class="btn btn--ghost btn--sm" type="button" (click)="removeAmenity(a)">Remove</button>
                </li>
              }
            </ul>
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: var(--s6) var(--s5) var(--s8);
      }

      .tabs {
        display: flex;
        gap: var(--s4);
        border-bottom: 1px solid var(--line);
        margin: var(--s5) 0;
      }

      .tabs button {
        background: none;
        border: 0;
        border-bottom: 2px solid transparent;
        padding: var(--s2) 0;
        cursor: pointer;
        color: var(--ink-soft);
      }

      .tabs .on {
        color: var(--ink);
        border-bottom-color: var(--lamp);
      }

      .toolbar {
        display: flex;
        gap: var(--s3);
        align-items: flex-end;
        flex-wrap: wrap;
        margin-bottom: var(--s4);
        padding: var(--s4);
      }

      .toolbar .field {
        flex: 1 1 10rem;
        margin: 0;
      }

      .toolbar .narrow {
        flex: 0 1 7rem;
      }

      .table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .table th,
      .table td {
        text-align: left;
        padding: var(--s2) var(--s3);
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      .table th {
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-faint);
        font-family: var(--mono);
        font-weight: 500;
      }

      .roles {
        display: flex;
        gap: var(--s3);
        flex-wrap: wrap;
      }

      .check {
        display: flex;
        align-items: center;
        gap: var(--s1);
        font-size: 0.82rem;
      }

      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: var(--s2);
      }

      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s4);
        padding: var(--s3) var(--s4);
      }

      .row p {
        margin: var(--s1) 0 0;
      }

      .small {
        font-size: 0.85rem;
      }

      .tag {
        margin-left: var(--s2);
      }
    `,
  ],
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toasts = inject(ToastService);

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Accounts' },
    { key: 'roomTypes', label: 'Room types' },
    { key: 'amenities', label: 'Facilities' },
  ];

  protected readonly allRoles: Role[] = ['Traveller', 'HotelOwner', 'Admin'];

  protected readonly tab = signal<Tab>('users');
  protected readonly users = signal<User[]>([]);
  protected readonly roomTypes = signal<RoomType[]>([]);
  protected readonly amenities = signal<Amenity[]>([]);

  protected query = '';
  protected roomTypeDraft = { name: '', description: '', defaultCapacity: 2 };
  protected amenityDraft: { name: string; scope: AmenityScope } = { name: '', scope: 'Hotel' };

  ngOnInit(): void {
    this.loadUsers();
    this.loadCatalogues();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected loadUsers(): void {
    this.api.users({ query: this.query || undefined, pageSize: 50 }).subscribe({
      next: (page) => this.users.set(page.items),
      error: (err) => this.toasts.fromError(err, 'Could not load accounts.'),
    });
  }

  private loadCatalogues(): void {
    this.api.roomTypes().subscribe({
      next: (list) => this.roomTypes.set(list),
      error: () => undefined,
    });

    this.api.amenities().subscribe({
      next: (list) => this.amenities.set(list),
      error: () => undefined,
    });
  }

  protected toggleRole(user: User, role: Role): void {
    const roles = user.roles.includes(role)
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role];

    this.api.setUserRoles(user.id, roles).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.toasts.success(`Roles updated for ${updated.fullName}.`);
      },
      error: (err) => this.toasts.fromError(err, 'Could not change those roles.'),
    });
  }

  protected addRoomType(): void {
    if (!this.roomTypeDraft.name.trim()) return;

    this.api.saveRoomType(this.roomTypeDraft).subscribe({
      next: () => {
        this.roomTypeDraft = { name: '', description: '', defaultCapacity: 2 };
        this.toasts.success('Room type added.');
        this.loadCatalogues();
      },
      error: (err) => this.toasts.fromError(err, 'Could not add that room type.'),
    });
  }

  protected removeRoomType(type: RoomType): void {
    this.api.deleteRoomType(type.id).subscribe({
      next: () => {
        this.toasts.success(`${type.name} removed.`);
        this.loadCatalogues();
      },
      error: (err) =>
        this.toasts.fromError(err, 'Rooms still use this type, so it cannot be removed.'),
    });
  }

  protected addAmenity(): void {
    if (!this.amenityDraft.name.trim()) return;

    this.api.saveAmenity(this.amenityDraft).subscribe({
      next: () => {
        this.amenityDraft = { name: '', scope: 'Hotel' };
        this.toasts.success('Facility added.');
        this.loadCatalogues();
      },
      error: (err) => this.toasts.fromError(err, 'Could not add that facility.'),
    });
  }

  protected removeAmenity(amenity: Amenity): void {
    this.api.deleteAmenity(amenity.id).subscribe({
      next: () => {
        this.toasts.success(`${amenity.name} removed.`);
        this.loadCatalogues();
      },
      error: (err) => this.toasts.fromError(err),
    });
  }
}
