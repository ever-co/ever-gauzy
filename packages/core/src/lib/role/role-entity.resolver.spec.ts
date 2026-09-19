/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the entity
 * applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { RoleEntityResolver } from './role-entity.resolver';

/**
 * The gate over the role surface.
 *
 * `RoleEntityResolver` is one of the platform's kernel resolvers: it serves the role domain over GraphQL
 * under the guard chain and the permission its own routes carry. This suite pins the one statement that
 * sits on top of them — the gate on the endpoint itself — because a capability an operator switches off
 * has to be refused here the way a disabled capability's REST routes are refused, and because a resolver
 * that quietly lost the gate would keep serving a capability the operator believes they closed.
 */

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (RoleEntityResolver.prototype as never)[field],
		getClass: () => RoleEntityResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('RoleEntityResolver — a capability that is switched off is not served', () => {
	it('carries the gate on the class, beside the guard chain its own routes run under', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — and appended to the chain the routes already carry, never in
		// place of any part of it.
		expect(Reflect.getMetadata(FEATURE_METADATA, RoleEntityResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', RoleEntityResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('roles')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('roles');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('roles'))).resolves.toBe(true);
	});
});
