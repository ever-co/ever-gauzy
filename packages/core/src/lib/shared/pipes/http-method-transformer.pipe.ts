import { ValueTransformer } from 'typeorm';
import { RequestMethod, RequestMethodEnum } from '@gauzy/contracts';

/**
 * HttpMethodTransformerPipe handles the conversion between enum integer (stored in DB)
 * and the corresponding HTTP method string (e.g., 'GET', 'POST', etc.).
 */
export class HttpMethodTransformerPipe implements ValueTransformer {
	/**
	 * A map of HTTP method strings to their corresponding enum values.
	 */
	private static methodMap = new Map<string, RequestMethod>([
		['GET', RequestMethod.GET],
		['POST', RequestMethod.POST],
		['PUT', RequestMethod.PUT],
		['DELETE', RequestMethod.DELETE],
		['PATCH', RequestMethod.PATCH],
		['OPTIONS', RequestMethod.OPTIONS],
		['HEAD', RequestMethod.HEAD],
		['SEARCH', RequestMethod.SEARCH]
	]);

	/**
	 * A map of enum values to their corresponding HTTP method strings.
	 */
	private static reverseMethodMap = new Map<RequestMethod, string>([
		[RequestMethod.GET, 'GET'],
		[RequestMethod.POST, 'POST'],
		[RequestMethod.PUT, 'PUT'],
		[RequestMethod.DELETE, 'DELETE'],
		[RequestMethod.PATCH, 'PATCH'],
		[RequestMethod.OPTIONS, 'OPTIONS'],
		[RequestMethod.HEAD, 'HEAD'],
		[RequestMethod.SEARCH, 'SEARCH'],
		[RequestMethod.ALL, 'ALL']
	]);

	/**
	 * Converts the HTTP method string to the corresponding enum value when writing to the database.
	 *
	 * @param value - The HTTP method string (e.g., 'GET', 'POST').
	 * @returns The corresponding RequestMethod enum value.
	 */
	to(value: string): RequestMethod {
		return HttpMethodTransformerPipe.methodMap.get(value.toUpperCase()) || RequestMethod.ALL;
	}

	/**
	 * Converts the enum value to the corresponding HTTP method string when reading from the database.
	 *
	 * @param value - The enum value (e.g., RequestMethod.GET).
	 * @returns The corresponding HTTP method string.
	 */
	from(value: RequestMethod): string {
		return HttpMethodTransformerPipe.reverseMethodMap.get(value) || RequestMethodEnum.ALL;
	}
}
