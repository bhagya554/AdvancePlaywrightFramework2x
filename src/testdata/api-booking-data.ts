import { faker } from '@faker-js/faker';
import type { Booking } from '@api/BookingApi';
import { DataGenerator } from '@utils/DataGenerator';

function isoDate(daysFromNow: number): string {
  const d = faker.date.soon({
    days: daysFromNow,
    refDate: '2026-01-01T00:00:00'
  });

  return d.toISOString().slice(0, 10);
}

export function buildBooking(
  overrides: Partial<Booking> = {}
): Booking {
  return {
    firstname: faker.person.firstName(),
    lastname: faker.person.lastName(),
    totalprice: faker.number.int({ min: 100, max: 1000 }),
    depositpaid: faker.datatype.boolean(),
    bookingdates: {
      checkin: '2026-02-01',
      checkout: isoDate(30),
    },
    additionalneeds: faker.helpers.arrayElement([
      'Breakfast',
      'Late checkout'
    ]),
    ...overrides,
  };
}

/** Booking payload sourced from DataGenerator.booking() instead of faker directly. */
export function buildBookingFromDataGenerator(
  overrides: Partial<Booking> = {}
): Booking {
  return DataGenerator.booking(overrides);
}