import Ajv, { type AnySchema } from 'ajv';
import addFormats from 'ajv-formats';

// One shared instance: AJV caches compiled schemas, so re-validating is cheap.
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/** Validates data against a JSON schema. Returns readable errors; empty array = valid. */
export function validateSchema(schema: AnySchema, data: unknown): string[] {
    const validate = ajv.compile(schema);
    return validate(data)
        ? []
        : (validate.errors ?? []).map(e => `${e.instancePath || '(root)'} ${e.message}`);
}
