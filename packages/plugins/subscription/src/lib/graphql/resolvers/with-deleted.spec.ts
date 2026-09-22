/**
 * The soft-delete visibility of the subscription domain's four list fields (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing,
 * so a client that can ask REST for the retired rows could not ask GraphQL for them at all.
 *
 * `@gauzy/core` boots the application graph from its barrel and `@gauzy/common` resolves the feature
 * catalogue at import time, neither of which a resolver needs; both are substituted at their module
 * boundary, as this package's own specs do. The resolvers under test are the real ones, and the two
 * things that make the assertions mean something are real too: the document the SDL is read from, and
 * the kernel's own connection helpers the list fields page with — a double of those would let a page
 * drift from the contract in a suite that still passed.
 */
jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a module graph. */
	const decorator = () => () => undefined;
	const connection = jest.requireActual('@gauzy/core/src/lib/api/graphql-connection');

	return {
		Permissions: decorator,
		Idempotent: decorator,
		Versioned: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		DEFAULT_CONNECTION_PAGE_SIZE: connection.DEFAULT_CONNECTION_PAGE_SIZE,
		MAX_CONNECTION_PAGE_SIZE: connection.MAX_CONNECTION_PAGE_SIZE,
		resolveConnectionWindow: connection.resolveConnectionWindow,
		connectionFromOffsetPage: connection.connectionFromOffsetPage,
		decodeOffsetCursor: connection.decodeOffsetCursor,
		encodeOffsetCursor: connection.encodeOffsetCursor,
		paginateRows: connection.paginateRows
	};
});

// The collaborators a resolver injects are doubled at their own modules, so nothing below them is
// loaded: what these cases assert is the options the field hands its service, not what it returns.
jest.mock('../../subscription/subscription.service', () => ({ SubscriptionService: class SubscriptionService {} }));
jest.mock('../../subscription-plan/subscription-plan.service', () => ({
	SubscriptionPlanService: class SubscriptionPlanService {}
}));
jest.mock('../../subscription-item/subscription-item.service', () => ({
	SubscriptionItemService: class SubscriptionItemService {}
}));
jest.mock('../../subscription-billing/subscription-billing.service', () => ({
	SubscriptionBillingService: class SubscriptionBillingService {}
}));

import { ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from 'graphql';
import { schemaExtensions } from '../schema-extensions';
import { SubscriptionBillingResolver } from './subscription-billing.resolver';
import { SubscriptionItemResolver } from './subscription-item.resolver';
import { SubscriptionPlanResolver } from './subscription-plan.resolver';
import { SubscriptionResolver } from './subscription.resolver';

/** One page, as a service double answers it. */
const EMPTY_PAGE = { items: [], total: 0 };

/**
 * A service double that records the options it was handed.
 *
 * @returns The double and the options it received, in order.
 */
function recordingService(): { service: Record<string, unknown>; calls: Array<Record<string, any>> } {
	const calls: Array<Record<string, any>> = [];

	return {
		calls,
		service: {
			findAll: async (options: Record<string, any>) => {
				calls.push(options);

				return EMPTY_PAGE;
			}
		}
	};
}

/** A service nothing in these cases is expected to call. */
const unusedService = (): Record<string, unknown> => ({});

/** The four fields the REST surface already lets a caller ask for retired rows on. */
const CONVERTED = ['subscriptionPlans', 'subscriptions', 'subscriptionItems', 'subscriptionBillings'];

describe('the subscription document — the list fields offer the soft-delete visibility the REST routes do', () => {
	it.each(CONVERTED)('declares `withDeleted: Boolean` on %s', (name) => {
		const query = schemaExtensions.definitions.find(
			(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
				(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
				definition.name.value === 'Query'
		);
		const field = query?.fields?.find((candidate) => candidate.name.value === name);

		if (!field) {
			throw new Error(`the subscription document declares no Query field named "${name}"`);
		}

		const argument = field.arguments?.find((candidate) => candidate.name.value === 'withDeleted');

		expect(argument && `${argument.type.kind === 'NamedType' ? argument.type.name.value : ''}`).toBe('Boolean');
	});

	it('keeps the `page` argument the connections are walked with', () => {
		for (const name of CONVERTED) {
			const query = schemaExtensions.definitions.find(
				(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
					(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
					definition.name.value === 'Query'
			);
			const declared = (query?.fields?.find((candidate) => candidate.name.value === name)?.arguments ?? []).map(
				(argument) => argument.name.value
			);

			expect(declared).toContain('page');
		}
	});
});

describe('the subscription resolvers — the flag reaches the read rather than being dropped at the field', () => {
	it('forwards it into `subscriptionPlans`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new SubscriptionPlanResolver(service as never);

		await resolver.subscriptionPlans(undefined, undefined, true);
		await resolver.subscriptionPlans();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `subscriptions`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new SubscriptionResolver(
			service as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.subscriptions(undefined, undefined, true);
		await resolver.subscriptions();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `subscriptionItems`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new SubscriptionItemResolver(service as never, unusedService() as never);

		await resolver.subscriptionItems(undefined, undefined, true);
		await resolver.subscriptionItems();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `subscriptionBillings`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new SubscriptionBillingResolver(service as never);

		await resolver.subscriptionBillings(undefined, undefined, true);
		await resolver.subscriptionBillings();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});
});
