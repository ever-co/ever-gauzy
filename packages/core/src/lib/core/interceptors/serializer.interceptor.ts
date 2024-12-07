import { Injectable, ExecutionContext, CallHandler, ClassSerializerInterceptor, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';
import { verify } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';

@Injectable()
export class SerializerInterceptor extends ClassSerializerInterceptor implements NestInterceptor {
	/**
	 * Intercepts the response and transforms the data based on the user's role.
	 *
	 * @param ctx - The execution context.
	 * @param next - The call handler.
	 * @returns An observable that represents the intercepted response.
	 */
	intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
		// Extract the current token from the request context
		const token = RequestContext.currentToken();

		// Verify the token and extract the user's role
		const { role } = verify(token, environment.JWT_SECRET) as {
			id: string;
			role: RolesEnum;
		};

		// Handle the response and transform the data based on the role
		return next.handle().pipe(map((data) => instanceToPlain(data, { groups: [role] })));
	}
}
