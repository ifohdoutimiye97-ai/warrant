/**
 * Pure helpers that can be imported from either server or client code
 * without dragging in node:fs. Keep this file free of Node.js APIs.
 */

const placeholderTokenPattern = /\b(TBD[A-Z0-9_]*|Optional)\b/;

export function isPlaceholder(value: string | undefined | null) {
  return !value || placeholderTokenPattern.test(value);
}
