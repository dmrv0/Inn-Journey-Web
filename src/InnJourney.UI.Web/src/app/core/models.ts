/** Mirrors the contracts in InnJourney.Application.Common. */

export type Role = 'Traveller' | 'HotelOwner' | 'Admin';

export type ReservationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'Cancelled';

export type PaymentStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Refunded';

export type RoomStatus = 'Available' | 'OutOfService';

export type AmenityScope = 'Hotel' | 'Room';

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  emailConfirmed: boolean;
  roles: Role[];
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  user: User;
}

export interface Amenity {
  id: string;
  name: string;
  iconUrl: string | null;
  scope: AmenityScope;
}

export interface Address {
  line: string;
  city: string;
  country: string;
  postalCode: string | null;
}

export interface HotelImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
}

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  defaultCapacity: number;
}

export interface Room {
  id: string;
  hotelId: string;
  number: string;
  capacity: number;
  adultPrice: number;
  childPrice: number;
  status: RoomStatus;
  roomType: RoomType | null;
  amenities: Amenity[];
}

export interface HotelSummary {
  id: string;
  name: string;
  description: string | null;
  stars: number;
  averageRating: number;
  reviewCount: number;
  address: Address;
  coverImageUrl: string | null;
  fromPrice: number | null;
  amenities: Amenity[];
}

export interface HotelDetail {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  googleMapsUrl: string | null;
  stars: number;
  averageRating: number;
  reviewCount: number;
  address: Address;
  images: HotelImage[];
  amenities: Amenity[];
  rooms: Room[];
}

export interface AvailableRoom {
  room: Room;
  totalPrice: number;
  nights: number;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  cardLast4: string | null;
  failureReason: string | null;
  processedAt: string;
}

export interface Reservation {
  id: string;
  reference: string;
  hotelId: string;
  hotelName: string;
  roomId: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalPrice: number;
  status: ReservationStatus;
  allowedNextStatuses: ReservationStatus[];
  payment: Payment | null;
  canReview: boolean;
}

export interface Review {
  id: string;
  hotelId: string;
  authorName: string;
  rating: number;
  comment: string | null;
  ownerResponse: string | null;
  respondedAt: string | null;
  createdDate: string | null;
}

export interface OccupancyRoom {
  roomId: string;
  number: string;
  capacity: number;
  occupiedDates: string[];
}

export interface Occupancy {
  hotelId: string;
  from: string;
  to: string;
  rooms: OccupancyRoom[];
}

export interface RevenuePoint {
  date: string;
  amount: number;
  bookings: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  paidBookings: number;
  averageBookingValue: number;
  series: RevenuePoint[];
}

export interface HotelSearchParams {
  query?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  minStars?: number;
  minRating?: number;
  amenityIds?: string[];
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** RFC 7807 problem response, as produced by the API's error middleware. */
export interface ProblemDetails {
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}
