/**
 * Convert a camelCase string to snake_case.
 *
 * @param string - The camelCase string to convert.
 * @returns The converted snake_case string.
 */
export const camelToSnakeCase = (string: string): string => string.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
