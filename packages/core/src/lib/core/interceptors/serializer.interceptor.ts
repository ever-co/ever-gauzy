import { Injectable, ExecutionContext, CallHandler, ClassSerializerInterceptor, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';
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
		// The role the caller holds in the database, attached to the request by JwtStrategy. The token's
		// `role` claim would keep exposing a demoted user's former serialization groups (and decoding it
		// here threw outright on a request that carries no bearer token).
		const role: RolesEnum | null = RequestContext.currentRoleName();

		// Handle the response and transform the data based on the role
		return next.handle().pipe(map((data) => instanceToPlain(data, { groups: role ? [role] : [] })));
	}
}
