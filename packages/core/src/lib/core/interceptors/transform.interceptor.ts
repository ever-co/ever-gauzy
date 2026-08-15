import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	HttpException,
	HttpStatus,
	BadRequestException
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
	/**
	 * Intercepts the execution context and the call handler.
	 * Transforms the data using class-transformer's instanceToPlain.
	 * Catches and handles errors, returning appropriate exceptions.
	 * @param ctx - The execution context.
	 * @param next - The call handler.
	 * @returns An observable that represents the intercepted response.
	 */
	intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			// Transform the data using class-transformer's instanceToPlain
			map((data) => instanceToPlain(data)),
			// Catch and handle errors
			catchError((error: any) => {
				// If it's a BadRequestException, return a new instance of BadRequestException
				if (error instanceof BadRequestException) {
					throw new BadRequestException(error.getResponse());
				}
				// Every other HTTP exception is re-thrown AS IS. Re-wrapping it as
				// `new HttpException(error.message, error.status)` used to flatten a structured
				// response body (e.g. the AI dictation 503 `{ message, code, settingsPath }`) down to
				// `{ statusCode, message }`, so clients could never branch on anything but text.
				if (error instanceof HttpException) {
					throw error;
				}
				// A non-HTTP error (TypeORM, a plain Error, a thrown object). It must NOT become
				// `new HttpException(message, undefined)`: with an undefined status Express kept the
				// default 200 and the client received `{ message }` as a SUCCESSFUL response — the
				// documents editor, for one, then opened an id-less "Untitled" page. Honour a numeric
				// `status` if the error carries one, else it is a server error.
				const status = Number.isInteger(error?.status) ? error.status : HttpStatus.INTERNAL_SERVER_ERROR;
				throw new HttpException(error?.message ?? 'Internal server error', status);
			})
		);
	}
}
