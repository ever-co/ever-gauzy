import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { Entitlement } from './entitlement/entitlement.entity';
import { EntitlementActivation } from './entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from './entitlement-key/entitlement-key.entity';
import { EntitlementActivationStatus } from './entitlement.enums';

/**
 * The occupancy counters, re-derived rather than incremented.
 *
 * `entitlement.activationCount` and `entitlement_key.activationCount` are caches: they exist so that
 * the activation ceiling is one row read on the hot path, and they are written here by counting the
 * live activation rows — never by adding one. That is the whole point. A counter that is incremented
 * by every path that takes a seat and decremented by every path that gives one back drifts the first
 * time a path forgets, and the drift is invisible until a customer is refused a seat they paid for;
 * a count re-derived from the rows the decision was made on cannot drift.
 *
 * Every function here takes the caller's transaction manager, because a counter repaired outside the
 * transaction that changed the rows would be a third state between the two.
 */

/**
 * Re-derives the live activation count of an entitlement and of each of its keys.
 *
 * @param manager The caller's transaction manager.
 * @param entitlementId The entitlement whose counters are re-derived.
 * @returns The number of live activations the entitlement has.
 */
export async function recountEntitlementOccupancy(manager: EntityManager, entitlementId: ID): Promise<number> {
	const live = await manager.count(EntitlementActivation, {
		where: { entitlementId, status: EntitlementActivationStatus.ACTIVE } as any
	});

	// The counter is a cache re-derived from the rows counted above, never a value a caller states, so
	// this statement carries no version predicate and moves no revision: the revision belongs to the
	// right's own columns and is moved by the statement that changes them. A write that bumped it here
	// would report two revisions for one state change, and would skip the repair the moment the row had
	// moved on — leaving the count stale, which is the one thing this helper exists to prevent.
	await manager.update(Entitlement, { id: entitlementId } as any, { activationCount: live } as any);

	const keys = await manager.find(EntitlementKey, { where: { entitlementId } as any });

	for (const key of keys) {
		const keyLive = await manager.count(EntitlementActivation, {
			where: {
				entitlementId,
				entitlementKeyId: key.id,
				status: EntitlementActivationStatus.ACTIVE
			} as any
		});

		if (Number(key.activationCount ?? 0) !== keyLive) {
			await manager.update(EntitlementKey, { id: key.id } as any, { activationCount: keyLive } as any);
		}
	}

	return live;
}

/**
 * Counts the live activations of an entitlement without writing anything.
 *
 * The check path uses this rather than the cache: the seat ceiling is a fact about rows, and a
 * validation call that trusted a stale cache would hand out a seat the tenant did not sell.
 *
 * @param manager The entity manager to read through.
 * @param entitlementId The entitlement.
 * @returns The number of live activations.
 */
export async function countLiveActivations(manager: EntityManager, entitlementId: ID): Promise<number> {
	return await manager.count(EntitlementActivation, {
		where: { entitlementId, status: EntitlementActivationStatus.ACTIVE } as any
	});
}
