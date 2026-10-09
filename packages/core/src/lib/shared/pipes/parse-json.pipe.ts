import {
	ArgumentMetadata,
	BadRequestException,
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
/** Maximum nesting depth accepted for a `?data=` JSON query object. */
export const MAX_QUERY_JSON_DEPTH = 32;

export function omitNullValues<T>(value: T, depth = 0): T {
	// A filter object is a handful of levels deep at most; refuse pathological nesting instead of
	// letting a crafted payload exhaust the stack (which would surface as a swallowed parse error).
	if (depth > MAX_QUERY_JSON_DEPTH) {
		throw new BadRequestException('Query JSON is nested too deeply');
	}
	if (Array.isArray(value)) {
		return value.map((item) => omitNullValues(item, depth + 1)) as unknown as T;
	}
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, v]) => v !== null)
				.map(([k, v]) => [k, omitNullValues(v, depth + 1)])
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
			let parsed: unknown;
			try {
				parsed = JSON.parse(value);
			} catch (e) {
				console.log('Json Parser Error:', e);
				return {};
			}
			// Outside the parse try: a sanitizer failure (e.g. excessive nesting) is the caller's error
			// and must surface as a 400, not be swallowed as "invalid JSON" and turned into {}.
			return omitNullValues(parsed);
		} else if (this.throwInvalidError) {
			throw this.exceptionFactory(
				'Validation failed (JSON string is expected)'
			);
		}

		return {};
	}
}
