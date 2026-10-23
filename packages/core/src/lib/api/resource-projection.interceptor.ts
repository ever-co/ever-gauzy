import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
	Optional,
	Type,
	UseInterceptors
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FieldVisibility } from './field-visibility.service';
import { collectVisibleWithFields, findWithheldField, readRequestedFields } from './visibility-metadata';

/**
 * Applies every field-level visibility declaration to a REST response, and enforces it on a write.
 *
 * Mounting it is the only thing a route has to do; the declarations themselves live on the entity,
 * so a resource declares a gated field once and every route that renders it — and every DTO that
 * carries it — is covered. There is deliberately no global registration: a route that has not asked
 * for the projection returns exactly what it returned before, which is what lets the platform adopt
 * the declaration one resource at a time instead of changing every response at once.
 *
 * Two directions, two moments:
 *
 * - **In**, before the handler runs: a body that carries a gated field the caller may not set is
 *   refused, so the value never reaches a service.
 * - **Out**, before the response is serialized: a field the caller may not read is removed from
 *   every row. A caller that asked for it by name in `fields=` is answered `403` instead of being
 *   handed a response that silently lacks what it asked for.
 *
 * A GraphQL response is not projected here: a schema must not vary by caller, so the field stays
 * declared and resolves to `null` with a typed error through `FieldVisibility.guard`. The decisions
 * themselves are the same, which is what keeps the two surfaces from drifting.
 */
@Injectable()
export class ResourceProjectionInterceptor implements NestInterceptor {
	/**
	 * @param visibility The decision service. A module that provides one gets it injected; a route
	 * that mounts this interceptor through a decorator gets a default instance, because mounting the
	 * projection must not require its controller's module to declare a provider — the service holds no
	 * state of its own, it reads the caller's grants from the request context.
	 */
	constructor(@Optional() private readonly visibility: FieldVisibility = new FieldVisibility()) {}

	/**
	 * Refuses a gated write, then projects the response.
	 *
	 * @param context The execution context.
	 * @param next The call handler.
	 * @returns The projected response.
	 * @throws ApiException `403 PERMISSION_DENIED` when the body sets a field the caller may not
	 * set, or when the selection names a field the caller may not read.
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		// A GraphQL execution context has no response object and no `fields=` parameter; its gated
		// fields are resolved one by one through `FieldVisibility.guard`.
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest();

		this.rejectGatedWrite(request);

		return next.handle().pipe(
			map((data: unknown) => {
				this.rejectWithheldSelection(request, data);

				return this.visibility.projectResponse(data);
			})
		);
	}

	/**
	 * Refuses a create or update body that carries a field the caller may not set.
	 *
	 * The check runs against the body's own class, so a DTO that declares the property is enough —
	 * no route has to remember to list its gated fields. A property that is present but `undefined`
	 * is not "carried": a DTO declares its optional properties on every instance, and refusing a
	 * request that never supplied a value would break every ordinary update.
	 *
	 * @param request The HTTP request.
	 * @throws ApiException `403 PERMISSION_DENIED` before the handler runs.
	 */
	private rejectGatedWrite(request: unknown): void {
		const body = (request as { body?: unknown })?.body;

		if (!body || typeof body !== 'object') {
			return;
		}

		for (const entry of Array.isArray(body) ? body : [body]) {
			this.rejectGatedEntry(entry);
		}
	}

	/**
	 * Refuses one body, or one item of a list body.
	 *
	 * @param body The body or list item.
	 * @throws ApiException `403 PERMISSION_DENIED` when it carries a gated field.
	 */
	private rejectGatedEntry(body: unknown): void {
		if (!body || typeof body !== 'object') {
			return;
		}

		const entityType = body.constructor as Type<unknown>;

		for (const field of collectVisibleWithFields(entityType)) {
			if (!isCarried(body, field.property) || this.visibility.canSee(field.permission)) {
				continue;
			}

			this.visibility.assertCanSee(field.permission, {
				resource: entityType?.name,
				field: field.property,
				mode: 'write'
			});
		}
	}

	/**
	 * Refuses a request that named a gated field in its field selection.
	 *
	 * An explicit ask is an error rather than an empty value: the caller named the field, so a
	 * response that quietly omits it looks like a resource that has no such field, and the client
	 * concludes its selection was honoured.
	 *
	 * @param request The HTTP request.
	 * @param data The value the handler returned, which names the response's class.
	 * @throws ApiException `403 PERMISSION_DENIED` with `details.field` and
	 * `details.requiredPermission`.
	 */
	private rejectWithheldSelection(request: unknown, data: unknown): void {
		const paths = readRequestedFields((request as { apiQuery?: { fields?: unknown } })?.apiQuery?.fields);

		if (paths.length === 0) {
			return;
		}

		const row = firstRow(data);

		if (!row) {
			return;
		}

		const entityType = row.constructor as Type<unknown>;
		const named = findWithheldField(paths, collectVisibleWithFields(entityType));

		if (!named || this.visibility.canSee(named.permission)) {
			return;
		}

		this.visibility.assertCanSee(named.permission, {
			resource: entityType?.name,
			field: named.property
		});
	}
}

/**
 * Mounts the field-level projection on one route.
 *
 * The query protocol mounts it together with its pipe; a route that renders a resource with gated
 * fields but has not adopted the protocol mounts this directly, and gets the projection and the
 * write check without any other change:
 *
 * ```ts
 * @ProjectedResponse()
 * @Get('/pagination')
 * public async pagination(@Query() filter: BaseQueryDTO<OrderLine>) { … }
 * ```
 *
 * @returns The method decorator.
 */
export const ProjectedResponse = (): MethodDecorator => UseInterceptors(ResourceProjectionInterceptor);

/**
 * Whether a body supplies a property.
 *
 * @param body The body.
 * @param property The property name.
 * @returns True when a value was supplied, an explicit `null` included.
 */
function isCarried(body: object, property: string): boolean {
	return property in body && (body as Record<string, unknown>)[property] !== undefined;
}

/**
 * The class of the first row of a response.
 *
 * @param data The value a handler returned.
 * @returns The row, or undefined when the response carries none.
 */
function firstRow(data: unknown): object | undefined {
	if (Array.isArray(data)) {
		return data.find((entry): entry is object => !!entry && typeof entry === 'object');
	}

	if (data && typeof data === 'object') {
		const items = (data as { items?: unknown }).items;

		if (Array.isArray(items)) {
			return items.find((entry): entry is object => !!entry && typeof entry === 'object');
		}

		return data;
	}

	return undefined;
}
