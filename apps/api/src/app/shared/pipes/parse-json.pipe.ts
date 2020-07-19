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
 * JSON Parse Pipe
 * Validates UUID passed in request parameters.
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
				return JSON.parse(value);
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
