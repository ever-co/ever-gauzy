/**
 * `upcomingSubscriptionBilling` and its REST twin, `GET /subscriptions/:id/upcoming-billing`.
 *
 * The field was promised and served by nothing; it is built here as a preview of the next billing that
 * reuses the amount computation the bill itself uses (the service suite pins that the preview and the
 * cycle agree). This suite pins the surface, on both protocols at once, because §3.1's rule is that
 * GraphQL is never wider than REST:
 *
 * - the document declares the field with the one argument the route takes, answering a nullable preview
 *   whose money is `Decimal`, never `Float`;
 * - the field and the route reach the same service call with the same identifier and answer the same
 *   preview — or the same null, when there is no upcoming billing;
 * - both run under the same read grant, `SUBSCRIPTIONS_VIEW`, and the same guard chain, and the field
 *   states that it does not write.
 *
 * Nothing is doubled here but the service: the controller, the resolver and the document are the real ones.
 */

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IDEMPOTENT_METADATA_KEY, PermissionGuard, TenantPermissionGuard, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SubscriptionController } from '../../subscription/subscription.controller';
import { schemaExtensions } from '../schema-extensions';
import { SubscriptionResolver } from './subscription.resolver';

/** The subscription both surfaces preview. */
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000501';

/** What the service previews, so the two surfaces can be compared by identity. */
const PREVIEW = {
	subscriptionId: SUBSCRIPTION,
	amount: '108.000000',
	currency: 'USD',
	periodStart: new Date('2026-04-01T00:00:00.000Z'),
	periodEnd: new Date('2026-05-01T00:00:00.000Z'),
	nextBillingAt: new Date('2026-04-01T00:00:00.000Z')
};

/** One object type or extension of the document, by name. */
function objectType(name: string): ObjectTypeDefinitionNode | ObjectTypeExtensionNode {
	const found = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === name
	);

	if (!found) {
		throw new Error(`the subscription document declares no type named "${name}"`);
	}

	return found;
}

/** One field of an object type, by name. */
function fieldOf(type: string, name: string): FieldDefinitionNode | undefined {
	return objectType(type).fields?.find((field) => field.name.value === name);
}

/** The name of the type behind whatever wrappers a declaration states, and whether it is non-null. */
function typeOf(type: TypeNode): { name: string; nonNull: boolean } {
	const nonNull = type.kind === 'NonNullType';
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return { name: current.kind === 'NamedType' ? current.name.value : '', nonNull };
}

/** The permission a surface runs under: what its handler states, else what its class states. */
function permissionOf(surface: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (surface.prototype as any)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, surface)
	);
}

/** The guards a surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = Reflect.getMetadata('__guards__', (surface.prototype as any)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** Both surfaces over one stubbed service. */
function surfaces(answer: unknown) {
	const service = { previewNextBilling: jest.fn().mockResolvedValue(answer) };

	return {
		service,
		controller: new SubscriptionController(service as never),
		resolver: new SubscriptionResolver(service as never, {} as never, {} as never)
	};
}

describe('the subscription document — the upcoming billing is one field', () => {
	it('declares the field with the one argument the route takes, answering a nullable preview', () => {
		const field = fieldOf('Query', 'upcomingSubscriptionBilling');

		expect(field).toBeDefined();
		expect(field?.arguments?.map((argument) => argument.name.value)).toEqual(['id']);
		expect(typeOf(field?.arguments?.[0].type as TypeNode)).toEqual({ name: 'ID', nonNull: true });
		// Null is the answer for a subscription that will not bill again as it stands.
		expect(typeOf(field?.type as TypeNode)).toEqual({ name: 'UpcomingSubscriptionBilling', nonNull: false });
	});

	it('answers the amount as a Decimal and every member the preview carries', () => {
		const members = Object.fromEntries(
			(objectType('UpcomingSubscriptionBilling').fields ?? []).map((field) => [field.name.value, typeOf(field.type)])
		);

		expect(members).toEqual({
			subscriptionId: { name: 'ID', nonNull: true },
			amount: { name: 'Decimal', nonNull: true },
			currency: { name: 'String', nonNull: true },
			periodStart: { name: 'DateTime', nonNull: true },
			periodEnd: { name: 'DateTime', nonNull: true },
			nextBillingAt: { name: 'DateTime', nonNull: true }
		});
		// The members are exactly the service's answer's, so nothing the field declares is left unresolved.
		expect(Object.keys(members).sort()).toEqual(Object.keys(PREVIEW).sort());
	});
});

describe('upcomingSubscriptionBilling and GET /subscriptions/:id/upcoming-billing — one preview, two protocols', () => {
	it('reach the same service call with the same identifier, and answer the same preview', async () => {
		const { service, controller, resolver } = surfaces(PREVIEW);

		const overRest = await controller.upcomingBilling(SUBSCRIPTION);
		const overGraphql = await resolver.upcomingSubscriptionBilling(SUBSCRIPTION);

		expect(service.previewNextBilling).toHaveBeenNthCalledWith(1, SUBSCRIPTION);
		expect(service.previewNextBilling).toHaveBeenNthCalledWith(2, SUBSCRIPTION);
		expect(service.previewNextBilling).toHaveBeenCalledTimes(2);
		expect(overGraphql).toBe(overRest);
	});

	it('answer null on both surfaces when there is no upcoming billing', async () => {
		const { controller, resolver } = surfaces(null);

		await expect(controller.upcomingBilling(SUBSCRIPTION)).resolves.toBeNull();
		await expect(resolver.upcomingSubscriptionBilling(SUBSCRIPTION)).resolves.toBeNull();
	});

	it('let a refusal through on both surfaces rather than answering it as no billing', async () => {
		const refusal = new Error('The subscription was not found.');
		const service = { previewNextBilling: jest.fn().mockRejectedValue(refusal) };
		const controller = new SubscriptionController(service as never);
		const resolver = new SubscriptionResolver(service as never, {} as never, {} as never);

		await expect(controller.upcomingBilling(SUBSCRIPTION)).rejects.toBe(refusal);
		await expect(resolver.upcomingSubscriptionBilling(SUBSCRIPTION)).rejects.toBe(refusal);
	});

	it('run under the read grant, stated on both handlers', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SubscriptionController.prototype.upcomingBilling)).toEqual([
			SubscriptionPermissions.SUBSCRIPTIONS_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SubscriptionResolver.prototype.upcomingSubscriptionBilling)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, SubscriptionController.prototype.upcomingBilling)
		);
		expect(permissionOf(SubscriptionResolver, 'upcomingSubscriptionBilling')).toEqual(
			permissionOf(SubscriptionController, 'upcomingBilling')
		);
		// Not the billing grant: previewing a charge is reading, and a reader who may not bill may preview.
		expect(permissionOf(SubscriptionController, 'upcomingBilling')).not.toEqual([
			SubscriptionPermissions.SUBSCRIPTIONS_BILL
		]);
	});

	it('run the field under the guard chain the route runs under, and declare no write', () => {
		const routeGuards = guardsOf(SubscriptionController, 'upcomingBilling');

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(guardsOf(SubscriptionResolver, 'upcomingSubscriptionBilling')).toEqual(expect.arrayContaining(routeGuards));
		expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, SubscriptionResolver.prototype.upcomingSubscriptionBilling)).toMatchObject({
			write: false
		});
		// A read claims no retry key on either surface.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, SubscriptionResolver.prototype.upcomingSubscriptionBilling)).toBeUndefined();
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, SubscriptionController.prototype.upcomingBilling)).toBeUndefined();
	});
});
