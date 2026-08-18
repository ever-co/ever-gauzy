import {
	ArgumentMetadata,
	HttpStatus,
	Injectable,
	Optional,
	PipeTransform
} from '@nestjs/common';
import {
	ErrorHttpStatusCode,
	HttpErrorByCode
} from '@nestjs/common/utils/http-error-by-code.util';
import { isJSON } from 'class-validator';

export interface ParseJsonPipeOptions {
	throwInvalidError?: boolean;
	errorHttpStatusCode?: ErrorHttpStatusCode;
	exceptionFactory?: (error: string) => any;
}

/**
 * Drops object properties whose value is `null`, recursively (array elements are recursed into but
 * never removed). Rebuilt with `Object.fromEntries`, which defines own data properties and so cannot
 * be used to reach `__proto__`.
 *
 * Why: this pipe feeds client-supplied `?data={ findInput, relations, ... }` filter objects straight
 * into TypeORM `where` clauses. At this ingress a JSON `null` has only ever meant "not filtered on
 * this key" (TypeORM 0.3 skipped it, and the clients were written against that). TypeORM is now
 * configured to translate `null` into `IS NULL` — the fail-closed choice for server code, which spells
 * `IS NULL` out with the explicit `IsNull()` operator — so the client's meaning is preserved here by
 * removing the key before the value ever reaches a query. See TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
 * in @gauzy/config (GHSA-44pv-34gx-q9p4).
 */
export function omitNullValues<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => omitNullValues(item)) as unknown as T;
	}
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, v]) => v !== null)
				.map(([k, v]) => [k, omitNullValues(v)])
		) as T;
	}
	return value;
}

/**
 * JSON Parse Pipe
 * Parses a JSON-encoded query parameter (e.g. `?data={...}`) into an object. `null` property values
 * are dropped (see {@link omitNullValues}).
 */
@Injectable()
export class ParseJsonPipe implements PipeTransform<string> {
	/**
	 * Throw invalid JSON error or not ? default to "false"
	 */
	protected throwInvalidError: boolean;

	protected exceptionFactory: (error: string) => any;

	/**
	 * Instance of class-validator
	 * Can not be easily injected, and there's no need to do so as we
	 * only use it for json validation method.
	 */

	constructor(@Optional() options?: ParseJsonPipeOptions) {
		options = options || {};

		const {
			exceptionFactory,
			errorHttpStatusCode = HttpStatus.BAD_REQUEST,
			throwInvalidError = false
		} = options;

		this.throwInvalidError = throwInvalidError;
		this.exceptionFactory =
			exceptionFactory ||
			((error) => new HttpErrorByCode[errorHttpStatusCode](error));
	}

	/**
	 * @param value currently processed route argument
	 * @param metadata contains metadata about the currently processed route argument
	 */
	async transform(value: string, metadata: ArgumentMetadata): Promise<any> {
		const isJson = isJSON(value);

		if (isJson) {
			try {
				return omitNullValues(JSON.parse(value));
			} catch (e) {
				console.log('Json Parser Error:', e);
			}
		} else if (this.throwInvalidError) {
			throw this.exceptionFactory(
				'Validation failed (JSON string is expected)'
			);
		}

		return {};
	}
}
