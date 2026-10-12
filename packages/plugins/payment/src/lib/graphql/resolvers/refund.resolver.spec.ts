/**
 * The module boundaries are doubled for the reason the package's other resolver spec states:
 * `@gauzy/core` boots the whole application graph from its barrel and `@gauzy/config` reads the
 * environment at import time, neither of which a resolver needs.
 *
 * Two things are deliberately real, because the assertion is about them: the resolver itself, and the
 * decorators that write the metadata. `Permissions` is the platform's own key, so the value read below
 * is the value `PermissionGuard` reads in production — `getAllAndOverride(PERMISSIONS_METADATA, [handler,
 * class])` — rather than a copy of it.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantAwareCrudService: class TenantAwareCrudService {},
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		// The retry declaration the mutations carry is the kernel's own decorator, as it is in the
		// production graph: a double would make the resolver import a different function than the one
		// the interceptor reads.
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		// The connection helpers the list fields page and answer with, taken from the kernel rather than
		// restated: a double that stubbed them would let a page drift from the contract in a suite that
		// still passed, which is the whole class of defect the conversion removed.
		connectionFromPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').connectionFromPage,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		// The cursor the window reads is the kernel's own, so the spec mints one with the same codec the
		// endpoint does rather than with a literal — a literal would keep passing after the encoding changed.
		encodeOffsetCursor: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').encodeOffsetCursor,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

// The two collaborators the resolver injects, doubled so nothing below the resolver is loaded: the
// assertion is about the declaration on the field, not about what the field returns.
jest.mock('../../refund/refund.service', () => ({ RefundService: class RefundService {} }));
jest.mock('../../refund-line/refund-line.service', () => ({ RefundLineService: class RefundLineService {} }));

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard, encodeOffsetCursor } from '@gauzy/core';
import { ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from 'graphql';
import { PaymentPermission } from '../../payment.permissions';
import { schemaExtensions } from '../schema-extensions';
import { RefundResolver } from './refund.resolver';

/**
 * The refund's GraphQL fields, and the one that had no permission of its own.
 *
 * `RefundResolver` states a permission on every root field and none on the class, which is the
 * arrangement the rest of this package's resolvers use. `PermissionGuard` answers `true` when the
 * metadata it resolves is empty, so a field that states nothing of its own — and whose class states
 * nothing either — is a field the guard chain does not constrain: it is reachable by any authenticated
 * caller that can obtain a parent of its type. `lines` was exactly that, and this suite pins the
 * declaration that closes it, together with the guard chain that has to be present for any of the
 * declarations to be consulted at all.
 */
describe('RefundResolver — the declaration on each field (17 §3.2)', () => {
	it('carries the guard chain the permission declarations are enforced by', () => {
		// Without this chain the metadata asserted below is never read. The chain is asserted whole
		// rather than by membership, because a guard dropped to add another would still answer
		// `toContain`.
		expect(Reflect.getMetadata('__guards__', RefundResolver) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('states a permission on the read grants and on the approve grant', () => {
		const declared: Array<[string, string]> = [
			['refunds', PaymentPermission.REFUNDS_VIEW],
			['refund', PaymentPermission.REFUNDS_VIEW],
			['createRefund', PaymentPermission.REFUNDS_CREATE],
			['updateRefund', PaymentPermission.REFUNDS_CREATE],
			['cancelRefund', PaymentPermission.REFUNDS_CREATE],
			['approveRefund', PaymentPermission.REFUNDS_APPROVE]
		];

		for (const [handler, permission] of declared) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, (RefundResolver.prototype as never)[handler])).toEqual([
				permission
			]);
		}
	});

	it('states the read permission on the resolved field, which its parent is read under', () => {
		/*
		 * The control is the class. `RefundResolver` deliberately carries no class-level `@Permissions`,
		 * so a field with no declaration of its own inherits nothing and is guarded by nothing — the
		 * assertion on the class is what makes the assertion on the field mean something, because a
		 * class-level permission added later would make any field pass this test.
		 *
		 * The value is the one both surfaces already require for these rows: `GET /refunds/:id` carries
		 * `REFUNDS_VIEW`, and so does the refund-line resource's own list route. Declaring it changes no
		 * caller's answer.
		 */
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RefundResolver)).toBeUndefined();

		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, RefundResolver.prototype.lines)
		).toEqual([PaymentPermission.REFUNDS_VIEW]);
	});
});

/**
 * The soft-delete visibility of the refund list (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing,
 * so a client that can ask REST for the retired refunds could not ask GraphQL for them at all.
 *
 * The document is read from the real one — a member the document does not carry is a member no client
 * can send — and the field is then driven, because an argument the read drops is worse than a missing
 * one: the client is told it can ask and receives the same rows either way. The flag absent is asserted
 * too, where the option must be missing altogether rather than present as `false`, which is a statement
 * the caller never made.
 */
describe('RefundResolver — the soft-delete visibility the REST list route already has (17 §3.1)', () => {
	it('declares `withDeleted: Boolean` on `refunds` beside the arguments it already carried', () => {
		const query = schemaExtensions.definitions.find(
			(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
				(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
				definition.name.value === 'Query'
		);
		const field = query?.fields?.find((candidate) => candidate.name.value === 'refunds');

		if (!field) {
			throw new Error('the payment document declares no Query field named "refunds"');
		}

		const declared = (field.arguments ?? []).map((argument) => argument.name.value);

		expect(declared).toEqual(expect.arrayContaining(['filter', 'sort', 'limit', 'offset']));

		const argument = field.arguments?.find((candidate) => candidate.name.value === 'withDeleted');

		expect(argument && `${argument.type.kind === 'NamedType' ? argument.type.name.value : ''}`).toBe('Boolean');
	});

	it('forwards the flag into the read, and writes nothing when the caller states none', async () => {
		const calls: Array<Record<string, any>> = [];
		const resolver = new RefundResolver(
			{
				findRefunds: async (options: Record<string, any>) => {
					calls.push(options);

					return { items: [], total: 0 };
				}
			} as never,
			{} as never
		);

		await resolver.refunds(undefined, undefined, undefined, undefined, undefined, true);
		await resolver.refunds();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('reads the page the caller states, and reports a boundary that is true of the page it read', async () => {
		const calls: Array<Record<string, any>> = [];
		const resolver = new RefundResolver(
			{
				findRefunds: async (options: Record<string, any>) => {
					calls.push(options);

					return { items: [{ id: 'refund-3' }, { id: 'refund-4' }], total: 9 };
				}
			} as never,
			{} as never
		);

		// The field declared `page: PageInput` and read nothing from it: a client walking a page was
		// answered the unpaged default. The offset it names is the row the read starts at, and it reaches
		// the service as `skip`.
		const connection = await resolver.refunds(undefined, undefined, undefined, undefined, {
			first: 2,
			after: encodeOffsetCursor(1)
		});

		expect(calls[0]).toMatchObject({ skip: 2, take: 2 });
		expect(connection.pageInfo.hasPreviousPage).toBe(true);
		expect(connection.pageInfo.hasNextPage).toBe(true);

		// And the boundary it publishes is one its own window accepts back, which is what makes the walk a
		// walk: the cursors used to name a row while `after` read an offset.
		const resumed = await resolver.refunds(undefined, undefined, undefined, undefined, {
			first: 2,
			after: connection.pageInfo.endCursor ?? undefined
		});

		expect(calls[1]).toMatchObject({ skip: 4, take: 2 });
		expect(resumed.nodes).toHaveLength(2);
	});
});
