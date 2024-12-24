/**
 * Represents an object with custom fields.
 * @template T - Type of the custom fields.
 */
export interface CustomFieldsObject<T = any> {
	[key: string]: T;
}

/**
 * Represents an object with custom fields.
 * @template T - Type of the custom fields.
 */
export type NullableString = string | null;
