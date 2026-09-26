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
 * **It may also be written on the controller**, and {@link readBulkOperation} honours both: a resource
 * whose routes all accept batches declares itself once, and a route that takes a smaller one narrows it.
 * The declaration is typed for both because it is usable as both — a method-only type would make the
 * controller-level form a compile error while the reader kept looking for it, which is a documented
 * capability nobody could use.
 *
 * @param options The route's declaration, or the controller's default for its routes.
 * @returns The decorator.
 */
export const BulkOperation = (options: IBulkOperationOptions): MethodDecorator & ClassDecorator =>
	SetMetadata(BULK_OPERATION_METADATA, options);

/**
 * The declaration a route carries, or the one its controller declares for it.
 *
 * **The two levels are stored in two different places, and that is the whole subtlety here.** A method
 * decorator writes onto the method function — `SetMetadata` calls
 * `Reflect.defineMetadata(key, value, descriptor.value)` — while a class decorator writes onto the
 * constructor. A reader that asked for metadata *defined with an explicit property key* on the
 * prototype found neither, so a correctly decorated route was reported as declaring nothing; the
 * failure was invisible only because no route in this repository used the machinery until one did. All
 * four slots are therefore consulted, nearest first: the method's own record, then the prototype's, then
 * the constructor's, then the target handed in — which is what makes a controller-level default reach a
 * route that states none, and a route's own record win over it.
 *
 * @param target The controller's prototype, the controller itself, or a method function.
 * @param propertyKey The route's method name, when the caller knows it.
 * @returns The declaration, or undefined when the route accepts no batch.
 */
export function readBulkOperation(
	target: object,
	propertyKey?: string | symbol
): IBulkOperationOptions | undefined {
	if (!target) {
		return undefined;
	}

	const record = target as Record<string | symbol, unknown>;
	const method = propertyKey ? record[propertyKey] : undefined;

	// The controller's own declaration is the last of the four slots rather than the first, because a
	// route that states its own has to win over the default its controller states for it.
	const constructor = (target as { constructor?: object }).constructor;
	const declared = [
		method ? Reflect.getMetadata(BULK_OPERATION_METADATA, method) : undefined,
		propertyKey ? Reflect.getMetadata(BULK_OPERATION_METADATA, target, propertyKey) : undefined,
		constructor ? Reflect.getMetadata(BULK_OPERATION_METADATA, constructor) : undefined,
		Reflect.getMetadata(BULK_OPERATION_METADATA, target)
	].find((candidate) => candidate !== undefined);

	return declared as IBulkOperationOptions | undefined;
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
