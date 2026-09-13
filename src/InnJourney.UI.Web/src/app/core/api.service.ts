import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  Amenity,
  AuthResponse,
  AvailableRoom,
  HotelDetail,
  HotelSearchParams,
  HotelSummary,
  Occupancy,
  PagedResult,
  Payment,
  Reservation,
  RevenueSummary,
  Review,
  Room,
  RoomType,
  User,
} from './models';

/** Drops undefined, null and empty values so the query string stays readable. */
function toParams(source: Record<string, unknown>): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        params = params.append(key, String(item));
      }
    } else {
      params = params.set(key, String(value));
    }
  }

  return params;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // --- Hotels -------------------------------------------------------------

  searchHotels(params: HotelSearchParams): Observable<PagedResult<HotelSummary>> {
    return this.http.get<PagedResult<HotelSummary>>(`${this.base}/hotels`, {
      params: toParams({ ...params, amenityIds: params.amenityIds }),
    });
  }

  getHotel(id: string): Observable<HotelDetail> {
    return this.http.get<HotelDetail>(`${this.base}/hotels/${id}`);
  }

  getAvailability(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    adults: number,
    children: number
  ): Observable<AvailableRoom[]> {
    return this.http.get<AvailableRoom[]>(`${this.base}/hotels/${hotelId}/availability`, {
      params: toParams({ checkIn, checkOut, adults, children }),
    });
  }

  myHotels(page = 1, pageSize = 20): Observable<PagedResult<HotelSummary>> {
    return this.http.get<PagedResult<HotelSummary>>(`${this.base}/hotels/mine`, {
      params: toParams({ page, pageSize }),
    });
  }

  createHotel(body: unknown): Observable<HotelDetail> {
    return this.http.post<HotelDetail>(`${this.base}/hotels`, body);
  }

  updateHotel(id: string, body: unknown): Observable<HotelDetail> {
    return this.http.put<HotelDetail>(`${this.base}/hotels/${id}`, body);
  }

  deleteHotel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/hotels/${id}`);
  }

  uploadHotelImage(hotelId: string, file: File, altText?: string): Observable<unknown> {
    const form = new FormData();
    form.append('file', file);
    if (altText) form.append('altText', altText);

    return this.http.post(`${this.base}/hotels/${hotelId}/images`, form);
  }

  setCoverImage(hotelId: string, imageId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/hotels/${hotelId}/images/${imageId}/cover`, {});
  }

  deleteHotelImage(hotelId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/hotels/${hotelId}/images/${imageId}`);
  }

  getOccupancy(hotelId: string, from: string, to: string): Observable<Occupancy> {
    return this.http.get<Occupancy>(`${this.base}/hotels/${hotelId}/occupancy`, {
      params: toParams({ from, to }),
    });
  }

  getRevenue(hotelId: string, from: string, to: string): Observable<RevenueSummary> {
    return this.http.get<RevenueSummary>(`${this.base}/hotels/${hotelId}/revenue`, {
      params: toParams({ from, to }),
    });
  }

  // --- Rooms --------------------------------------------------------------

  getRooms(hotelId: string, page = 1, pageSize = 50): Observable<PagedResult<Room>> {
    return this.http.get<PagedResult<Room>>(`${this.base}/hotels/${hotelId}/rooms`, {
      params: toParams({ page, pageSize }),
    });
  }

  getRoom(roomId: string): Observable<Room> {
    return this.http.get<Room>(`${this.base}/rooms/${roomId}`);
  }

  createRoom(hotelId: string, body: unknown): Observable<Room> {
    return this.http.post<Room>(`${this.base}/hotels/${hotelId}/rooms`, body);
  }

  updateRoom(roomId: string, body: unknown): Observable<Room> {
    return this.http.put<Room>(`${this.base}/rooms/${roomId}`, body);
  }

  deleteRoom(roomId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rooms/${roomId}`);
  }

  // --- Reservations -------------------------------------------------------

  book(body: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
  }): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations`, body);
  }

  myReservations(upcoming?: boolean, page = 1, pageSize = 20): Observable<PagedResult<Reservation>> {
    return this.http.get<PagedResult<Reservation>>(`${this.base}/reservations/mine`, {
      params: toParams({ upcoming, page, pageSize }),
    });
  }

  getReservation(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.base}/reservations/${id}`);
  }

  hotelReservations(
    hotelId: string,
    params: { status?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}
  ): Observable<PagedResult<Reservation>> {
    return this.http.get<PagedResult<Reservation>>(`${this.base}/hotels/${hotelId}/reservations`, {
      params: toParams(params),
    });
  }

  cancelReservation(id: string): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations/${id}/cancel`, {});
  }

  checkIn(id: string): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations/${id}/check-in`, {});
  }

  checkOut(id: string): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations/${id}/check-out`, {});
  }

  // --- Payments -----------------------------------------------------------

  pay(body: {
    reservationId: string;
    cardHolderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvc: string;
  }): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/payments`, body);
  }

  myPayments(page = 1, pageSize = 20): Observable<PagedResult<Payment>> {
    return this.http.get<PagedResult<Payment>>(`${this.base}/payments/mine`, {
      params: toParams({ page, pageSize }),
    });
  }

  hotelPayments(hotelId: string, page = 1, pageSize = 20): Observable<PagedResult<Payment>> {
    return this.http.get<PagedResult<Payment>>(`${this.base}/hotels/${hotelId}/payments`, {
      params: toParams({ page, pageSize }),
    });
  }

  // --- Reviews ------------------------------------------------------------

  hotelReviews(hotelId: string, page = 1, pageSize = 10): Observable<PagedResult<Review>> {
    return this.http.get<PagedResult<Review>>(`${this.base}/hotels/${hotelId}/reviews`, {
      params: toParams({ page, pageSize }),
    });
  }

  myReviews(page = 1, pageSize = 20): Observable<PagedResult<Review>> {
    return this.http.get<PagedResult<Review>>(`${this.base}/reviews/mine`, {
      params: toParams({ page, pageSize }),
    });
  }

  createReview(body: { reservationId: string; rating: number; comment?: string }): Observable<Review> {
    return this.http.post<Review>(`${this.base}/reviews`, body);
  }

  respondToReview(reviewId: string, response: string): Observable<Review> {
    return this.http.post<Review>(`${this.base}/reviews/${reviewId}/response`, { response });
  }

  deleteReview(reviewId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/reviews/${reviewId}`);
  }

  // --- Catalogue ----------------------------------------------------------

  roomTypes(): Observable<RoomType[]> {
    return this.http.get<RoomType[]>(`${this.base}/room-types`);
  }

  saveRoomType(body: unknown): Observable<RoomType> {
    return this.http.post<RoomType>(`${this.base}/room-types`, body);
  }

  deleteRoomType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/room-types/${id}`);
  }

  amenities(scope?: 'Hotel' | 'Room'): Observable<Amenity[]> {
    return this.http.get<Amenity[]>(`${this.base}/amenities`, { params: toParams({ scope }) });
  }

  saveAmenity(body: unknown): Observable<Amenity> {
    return this.http.post<Amenity>(`${this.base}/amenities`, body);
  }

  deleteAmenity(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/amenities/${id}`);
  }

  // --- Users --------------------------------------------------------------

  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/users/me`);
  }

  updateProfile(body: { fullName: string; dateOfBirth?: string | null }): Observable<User> {
    return this.http.put<User>(`${this.base}/users/me`, body);
  }

  users(params: { query?: string; role?: string; page?: number; pageSize?: number } = {}) {
    return this.http.get<PagedResult<User>>(`${this.base}/users`, { params: toParams(params) });
  }

  setUserRoles(userId: string, roles: string[]): Observable<User> {
    return this.http.put<User>(`${this.base}/users/${userId}/roles`, { userId, roles });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post(`${this.base}/auth/change-password`, { currentPassword, newPassword });
  }

  refreshAuth(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/refresh`, {});
  }
}
