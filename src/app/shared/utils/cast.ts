/**
 * Narrows a string from an API payload to one of the front-end's string-literal union types, falling back to a
 * default when the field is missing or empty.
 *
 * This is a typed, but UNCHECKED, cast: an unexpected value from the server passes through unchanged. It exists so
 * mapper functions do not have to use `any`; validating against the allowed values would be the next step.
 */
export function asUnion<T extends string>(value: string | null | undefined, fallback: T): T {
  return (value as T | null | undefined) || fallback;
}
