/**
 * DataGenerator — Faker-backed fake data for the TTACart project.
 *
 * TTACart is a SauceDemo-style storefront: it needs login credentials and
 * checkout customer info (first name, last name, postal code). This util
 * centralises all random data so tests stay deterministic-friendly (one
 * import) and read naturally.
 *
 * Faker v10 API notes (v10 is ESM-only; tsconfig uses `module: preserve` /
 * `moduleResolution: bundler` so this import typechecks, and Node >= 22.12
 * resolves it at runtime via require(esm)):
 *   - `faker.internet.username()`         (lowercase; `userName()` was v8)
 *   - `faker.internet.password({length})` (options-object form)
 *   - `faker.location.zipCode()`          (v8 renamed `address` -> `location`)
 */


import { faker } from '@faker-js/faker';

export interface Credentials {
    username: string,
    password: string
}

export interface CheckoutCustomer {
    firstName: string,
    lastName: string,
    postalCode: string
}

export interface UserProfile extends Credentials, CheckoutCustomer {
    email: string,
    fullName: string,
    phone: string
}

export class DataGenerator {
    // ---------- credentials ----------

    /** Random username, e.g. "Otilia35". */
    static username(): string {
        return faker.internet.username();
    }

    static customUsername(firstName: string, lastName: string): string {
        return faker.internet.username({ firstName, lastName });
    }
    /**
     * Random password. Defaults to a 12-char password.
     * Pass length to tune for negative-test cases.
     */

    static password(length = 12): string {
        return faker.internet.password({ length })
    }

    /** Username + password pair. */
    static credentials(): Credentials {
        return {
            username: DataGenerator.username(),
            password: DataGenerator.password()
        }
    }

    // ---------- contact ----------
    static firstName(): string {
        return faker.person.firstName();
    }

    static lastName(): string {
        return faker.person.lastName();
    }

    static postalCode(): string {
        return faker.location.zipCode();
    }

    static email(): string {
        return faker.internet.email();
    }

    static customEmail(firstName: string, lastName: string): string {
        return faker.internet.email({ firstName, lastName });
    }

    static phone(): string {
        return faker.phone.number();
    }

    // ---------- composites ----------

    /** Customer info for the TTACart checkout step-one form. */
    static checkoutCustomer(): CheckoutCustomer {
        return {
            firstName: DataGenerator.firstName(),
            lastName: DataGenerator.lastName(),
            postalCode: DataGenerator.postalCode()
        }
    }

    /** Full profile — creds + checkout fields + contact. */
    static userProfile(): UserProfile {
        const firstName = DataGenerator.firstName()
        const lastName = DataGenerator.lastName()
        return {
            firstName,
            lastName,
            username: DataGenerator.customUsername(firstName, lastName),
            password: DataGenerator.password(),
            email: DataGenerator.customEmail(firstName, lastName),
            fullName: `${firstName} ${lastName}`,
            phone: DataGenerator.phone(),
            postalCode: DataGenerator.postalCode()
        }
    }
}

export default DataGenerator;