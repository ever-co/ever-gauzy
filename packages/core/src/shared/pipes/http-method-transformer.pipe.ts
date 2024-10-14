import { ValueTransformer } from 'typeorm';
import { RequestMethod } from '@gauzy/contracts';

/**
 * HttpMethodTransformerPipe handles the conversion between enum integer (stored in DB)
 * and the corresponding HTTP method string (e.g., 'GET', 'POST', etc.).
 */
export class HttpMethodTransformerPipe implements ValueTransformer {
	/**
	 * Converts the HTTP method string to the corresponding enum value when writing to the database.
	 *
	 * @param value - The HTTP method string (e.g., 'GET', 'POST').
	 * @returns The corresponding RequestMethod enum value.
	 */
	to(value: string): RequestMethod {
		switch (value.toUpperCase()) {
			case 'GET':
				return RequestMethod.GET;
			case 'POST':
				return RequestMethod.POST;
			case 'PUT':
				return RequestMethod.PUT;
			case 'DELETE':
				return RequestMethod.DELETE;
			case 'PATCH':
				return RequestMethod.PATCH;
			case 'OPTIONS':
				return RequestMethod.OPTIONS;
			case 'HEAD':
				return RequestMethod.HEAD;
			case 'SEARCH':
				return RequestMethod.SEARCH;
			default:
				return RequestMethod.ALL;
		}
	}

	/**
	 * Converts the enum value to the corresponding HTTP method string when reading from the database.
	 *
	 * @param value - The enum value (e.g., RequestMethod.GET).
	 * @returns The corresponding HTTP method string.
	 */
	from(value: RequestMethod): string {
		switch (value) {
			case RequestMethod.GET:
				return 'GET';
			case RequestMethod.POST:
				return 'POST';
			case RequestMethod.PUT:
				return 'PUT';
			case RequestMethod.DELETE:
				return 'DELETE';
			case RequestMethod.PATCH:
				return 'PATCH';
			case RequestMethod.OPTIONS:
				return 'OPTIONS';
			case RequestMethod.HEAD:
				return 'HEAD';
			case RequestMethod.SEARCH:
				return 'SEARCH';
			default:
				return 'ALL';
		}
	}
}
