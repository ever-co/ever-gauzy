import { Type, UseInterceptors, UsePipes } from '@nestjs/common';
import { DeprecationHeadersInterceptor } from './deprecation-headers.interceptor';
import { ResourceProjectionInterceptor } from './resource-projection.interceptor';
import { ApiQueryPipe, ApiQueryPipeOptions } from '../shared/pipes/api-query.pipe';
import type { ApiQuerySchema } from './query-schema';

/**
 * Mounts the query protocol on one route.
 *
 * ```ts
 * @ApiResource(orderQuerySchema)
 * @Controller('/orders')
 * export class OrderController {
 * 	@ApiQuery()
 * 	@Get()
 * 	async findAll(@Query() query: ApiQueryDTO) {
 * 		const apiQuery = currentApiQuery();
 * 		…
 * 	}
 * }
 * ```
 *
 * The decorator is the whole adoption step: the resource's declaration is already on the class,
 * and a route opts in by naming the same declaration here. Both halves are needed, and they cannot
 * disagree — the pipe validates against the schema it is given, and the declaration is read from
 * the class the route lives on.
 *
 * A composite rather than two decorators on every route, because the two halves are not
 * independently useful: a pipe without the interceptor compiles the query but tells the caller
 * nothing about the legacy parameter it translated, and the interceptor without the pipe writes
 * headers no request ever recorded.
 *
 * Adopting the protocol is also what turns field-level visibility on for a route: the projection is
 * mounted here beside the pipe, so a resource declares a gated field once on its entity and the
 * routes that speak the protocol project it. A route that has not adopted the protocol returns
 * exactly what it returned before — that is deliberate, and it is what lets the declaration land
 * one resource at a time.
 *
 * @param schema The resource's declaration. When omitted, the decorator still mounts the pipe and
 *   the pipe is a pass-through, which is what lets a route opt in before its declaration lands.
 * @returns The piped and intercepted route.
 */
export function ApiQuery(schema?: ApiQuerySchema): MethodDecorator & ClassDecorator {
	return applyApiQuery(schema ? { schema } : {});
}

/**
 * Mounts the query protocol with an explicit configuration.
 *
 * Exists for the one option a route may want beyond its declaration: the permission a caller needs
 * to ask for soft-deleted rows.
 *
 * @param options The pipe's configuration.
 * @returns The piped and intercepted route.
 */
export function ApiQueryWith(options: ApiQueryPipeOptions): MethodDecorator & ClassDecorator {
	return applyApiQuery(options);
}

/** Applies the pipe and the interceptors in one step. */
function applyApiQuery(options: ApiQueryPipeOptions): MethodDecorator & ClassDecorator {
	const pipe = UsePipes(new ApiQueryPipe(options));
	const interceptor = UseInterceptors(DeprecationHeadersInterceptor, ResourceProjectionInterceptor);
	const composite = (target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
		if (descriptor) {
			pipe(target, key as string | symbol, descriptor);
			return interceptor(target, key as string | symbol, descriptor);
		}
		pipe(target as Type<unknown>);
		return interceptor(target as Type<unknown>);
	};
	return composite as MethodDecorator & ClassDecorator;
}
