import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	HttpException,
	BadRequestException
} from '@nestjs/common';
import { Observable, of as observableOf } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class PublicTransformInterceptor implements NestInterceptor {

    intercept(
		ctx: ExecutionContext,
		next: CallHandler
	): Observable<any> {
		return next
			.handle()
			.pipe(
				map((data) => instanceToPlain(data)),
				catchError((error: any) => {
					if (error instanceof BadRequestException) {
						return observableOf(
							new BadRequestException(
								error.getResponse()
							)
						);
					}
					return observableOf(
						new HttpException(error.message, 404)
					);
				})
			);
	}
}