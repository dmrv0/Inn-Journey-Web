import { Routes } from '@angular/router';

import { anonymousOnlyGuard, roleGuard, signedInGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home.component').then((m) => m.HomeComponent),
    title: 'Inn Journey — rooms for the nights you need',
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search.component').then((m) => m.SearchComponent),
    title: 'Find a room · Inn Journey',
  },
  {
    path: 'hotels/:id',
    loadComponent: () => import('./pages/hotel.component').then((m) => m.HotelComponent),
    title: 'Hotel · Inn Journey',
  },
  {
    path: 'book/:roomId',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/book.component').then((m) => m.BookComponent),
    title: 'Confirm your stay · Inn Journey',
  },
  {
    path: 'reservations/:id',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./pages/reservation.component').then((m) => m.ReservationComponent),
    title: 'Your booking · Inn Journey',
  },
  {
    path: 'account',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/account.component').then((m) => m.AccountComponent),
    title: 'My stays · Inn Journey',
  },
  {
    path: 'sign-in',
    canActivate: [anonymousOnlyGuard],
    loadComponent: () => import('./pages/sign-in.component').then((m) => m.SignInComponent),
    title: 'Sign in · Inn Journey',
  },
  {
    path: 'register',
    canActivate: [anonymousOnlyGuard],
    loadComponent: () => import('./pages/register.component').then((m) => m.RegisterComponent),
    title: 'Create an account · Inn Journey',
  },
  {
    path: 'manage',
    canActivate: [roleGuard('HotelOwner')],
    loadComponent: () => import('./pages/manage/hotels.component').then((m) => m.ManageHotelsComponent),
    title: 'My properties · Inn Journey',
  },
  {
    path: 'manage/:id',
    canActivate: [roleGuard('HotelOwner')],
    loadComponent: () =>
      import('./pages/manage/hotel-dashboard.component').then((m) => m.HotelDashboardComponent),
    title: 'Property · Inn Journey',
  },
  {
    path: 'admin',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/admin.component').then((m) => m.AdminComponent),
    title: 'Admin · Inn Journey',
  },
  {
    path: 'no-access',
    loadComponent: () => import('./pages/message.component').then((m) => m.NoAccessComponent),
    title: 'No access · Inn Journey',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/message.component').then((m) => m.NotFoundComponent),
    title: 'Not found · Inn Journey',
  },
];
