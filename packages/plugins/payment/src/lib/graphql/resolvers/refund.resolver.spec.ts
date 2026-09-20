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
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent
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
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PaymentPermission } from '../../payment.permissions';
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
