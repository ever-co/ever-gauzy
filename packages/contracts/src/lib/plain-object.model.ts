/**
 * Represents a plain JavaScript object with string keys and values of any type.
 *
 * Example:
 * {
 *   "key1": "value",
 *   "key2": 123,
 *   "key3": true
 * }
 */
export interface PlainObject {
	[key: string]: any;
}
