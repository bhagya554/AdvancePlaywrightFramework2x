/**
 * env — typed reads of `process.env` for specs, page objects and config.
 *
 * dotenv is loaded ONCE, at the top of playwright.config.ts. Workers load that
 * config before any spec, so `process.env` is already populated by the time
 * anything imports this module. Nothing here calls `dotenv.config()`, and
 * nothing should — dotenv never overwrites an existing key, so a second call
 * is a no-op at best.
 *
 * A blank value (`TTA_ITEM_ID=` in .env) counts as unset, matching how
 * `resolveBaseURL()` treats a blank `BASE_URL`. That's what makes the
 * `cross-env BASE_URL= ...` pattern in package.json work.
 *
 *   import { env, requireEnv, envFlag } from '@config/env';
 *
 *   const itemId = env('TTA_ITEM_ID', 'test-allthethings-tshirt-red');
 *   const token  = requireEnv('API_TOKEN');          // throws if absent
 *   const shots  = envFlag('ATTACH_SCREENSHOTS');    // false unless truthy
 *
 * Never read `USERNAME` here: Windows sets it for every process, so a
 * `USERNAME=` line in .env is silently discarded. Use `STANDARD_USER`.
 */

/** Trimmed value, or undefined when missing or blank. */
function raw(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
}

/** Value from the environment, or `fallback` when unset or blank. */
export function env(key: string, fallback: string): string {
    return raw(key) ?? fallback;
}

/**
 * Value from the environment, or throw. Use for things with no sane default —
 * tokens, secrets — so a missing key fails loudly at load instead of surfacing
 * as a confusing assertion failure later.
 */
export function requireEnv(key: string): string {
    const value = raw(key);
    if (value === undefined) {
        throw new Error(`Missing required environment variable "${key}". Add it to .env — see .env.example.`);
    }
    return value;
}

/** Boolean flag. Accepts true/1/yes (case-insensitive); anything else is false. */
export function envFlag(key: string, fallback = false): boolean {
    const value = raw(key)?.toLowerCase();
    if (value === undefined) return fallback;
    return value === 'true' || value === '1' || value === 'yes';
}

/** Numeric value, falling back when unset or unparseable. */
export function envNumber(key: string, fallback: number): number {
    const value = raw(key);
    if (value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}