/**
 * CLIENT CONTRACT RULES:
 * - Only pass plain JSON data from Server → Client
 * - No functions
 * - No Date objects
 * - No class instances
 * - No DB-native objects
 *
 * Always normalize + assert before crossing the boundary.
 */

export function assertSerializableClientProps(value, path = "props") {
  if (process.env.NODE_ENV === "production") return;

  if (typeof value === "function") {
    throw new Error(`${path} is a function and cannot be passed to a Client Component`);
  }

  if (value instanceof Date) {
    throw new Error(`${path} is a Date. Convert to string before passing`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) =>
      assertSerializableClientProps(item, `${path}[${i}]`)
    );
    return;
  }

  if (value && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error(`${path} is not a plain object`);
    }

    for (const [key, val] of Object.entries(value)) {
      assertSerializableClientProps(val, `${path}.${key}`);
    }
  }
}

export function normalizeToClientSafeObject(obj) {
  if (obj === null || obj === undefined) return "";
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === "function") return undefined;
  if (Array.isArray(obj)) {
    return obj
      .map(normalizeToClientSafeObject)
      .filter((value) => value !== undefined);
  }
  if (!obj || typeof obj !== "object") return obj;

  const normalized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      normalized[key] = "";
    } else if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else if (typeof value === "function") {
      continue;
    } else if (Array.isArray(value)) {
      normalized[key] = value
        .map(normalizeToClientSafeObject)
        .filter((item) => item !== undefined);
    } else if (typeof value === "object") {
      normalized[key] = normalizeToClientSafeObject(value);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}
