import { env } from './env';

/**
 * TTACart login credentials, resolved from the environment.
 *
 * Uses env() rather than `??` so a blank `STANDARD_USER=` in .env counts as
 * unset and falls back, instead of handing tests an empty username.
 *
 * The keys are STANDARD_USER / TTA_SECRET — never USERNAME, which Windows
 * sets for every process and dotenv therefore cannot override.
 */
export const credentials = {
    standardUser: env('STANDARD_USER', 'standard_user'),
    password: env('TTA_SECRET', 'tta_secret'),
} as const;