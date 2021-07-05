import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { Observable, of as observableOf } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { classToPlain } from 'class-transformer';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  
    intercept(
		ctx: ExecutionContext, 
		next: CallHandler
	): Observable<any> {
		return next
			.handle()
			.pipe(
				map((data) => classToPlain(data)),
				catchError(
					(error) => observableOf(
						new HttpException(error.message, 404)
					)
				)
			);
	}
}