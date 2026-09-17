import { SetMetadata } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { IBulkExecutionOptions } from './bulk-executor.service';

/** The metadata key a bulk route's declaration is stored under. */
export const BULK_OPERATION_METADATA = 'api:bulk-operation';

/**
 * What a route declares about the batch it accepts.
 */
export interface IBulkOperationOptions {
	/** The resource that changes, as the result and the errors name it: `variant`. */
	readonly resource: string;
	/** The largest batch this resource accepts; the platform cap applies when it declares none. */
	readonly maxItems?: number;
	/** The single permission the whole request is authorised against. */
	readonly permission?: PermissionsEnum;
}

/**
 * Declares that a route accepts a batch.
 *
 * The declaration is what makes the route's bulk contract readable by something other than the
 * route: the executor is configured from it, the contract gates can enumerate the platform's bulk
 * routes, and the published API document describes the route as a bulk route rather than as an
 * ordinary `POST`. It is deliberately one decorator with no interceptor of its own — the checks a
 * batch needs (the cap, the authorisation decision, the per-item pre-pass) all live in the executor,
 * so a route cannot half-adopt the convention.
 *
 * ```ts
 * @BulkOperation({ resource: 'variant', maxItems: 200, permission: PermissionsEnum.PRODUCTS_EDIT })
 * @Post('/bulk')
 * public async bulk(@Body() request: BulkRequest<Variant>): Promise<BulkResult<Variant>> {
 * 	return this.bulkExecutor.execute(request, VariantController.apply, bulkOptionsOf(VariantController, 'bulk'));
 * }
 * ```
 *
 * @param options The route's declaration.
 * @returns The method decorator.
 */
export const BulkOperation = (options: IBulkOperationOptions): MethodDecorator =>
	SetMetadata(BULK_OPERATION_METADATA, options);

/**
 * The declaration a route carries.
 *
 * The method's declaration wins over the controller's, so a controller can declare the resource once
 * and a single route can narrow the cap.
 *
 * @param target The controller's prototype, or the controller itself.
 * @param propertyKey The route's method name.
 * @returns The declaration, or undefined when the route accepts no batch.
 */
export function readBulkOperation(
	target: object,
	propertyKey?: string | symbol
): IBulkOperationOptions | undefined {
	if (!target) {
		return undefined;
	}

	const own = propertyKey ? Reflect.getMetadata(BULK_OPERATION_METADATA, target, propertyKey) : undefined;

	return (own as IBulkOperationOptions) ?? (Reflect.getMetadata(BULK_OPERATION_METADATA, target) as IBulkOperationOptions);
}

/**
 * The executor options a route's declaration resolves to.
 *
 * Reading them from the declaration is what keeps a batch's resource name and cap in one place: a
 * second copy in the controller body is a second thing to update, and the copy that is wrong is the
 * one the client sees in an error.
 *
 * @param controller The controller class.
 * @param methodName The route's method name.
 * @param extensions Route-specific options the declaration cannot carry, such as the transactional
 * runner — a function, which does not belong in decorator metadata.
 * @returns The executor options.
 * @throws Error when the route carries no declaration, which is a programming mistake rather than a
 * request-level failure.
 */
export function bulkOptionsOf(
	controller: Function,
	methodName: string,
	extensions: Omit<Partial<IBulkExecutionOptions>, 'resource' | 'cap' | 'permission'> = {}
): IBulkExecutionOptions {
	const prototype = (controller as { prototype?: object }).prototype ?? controller;
	const declared = readBulkOperation(prototype, methodName);

	if (!declared) {
		throw new Error(
			`${controller?.name ?? 'The controller'}.${methodName} accepts a batch but declares no @BulkOperation.`
		);
	}

	return {
		resource: declared.resource,
		cap: declared.maxItems,
		permission: declared.permission,
		...extensions
	};
}
