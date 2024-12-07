import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	HttpException,
	BadRequestException
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class PublicTransformInterceptor implements NestInterceptor {
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
			map((data) => instanceToPlain(data)),
			catchError((error: any) => {
				// If it's a BadRequestException, return a new instance of BadRequestException
				if (error instanceof BadRequestException) {
					throw new BadRequestException(error.getResponse());
				}
				// For other errors, return a new instance of HttpException
				throw new HttpException(error.message, error.status);
			})
		);
	}
}
