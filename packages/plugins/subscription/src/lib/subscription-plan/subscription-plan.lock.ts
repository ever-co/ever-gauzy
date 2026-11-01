import { ID } from '@gauzy/contracts';
import { EntityManager } from 'typeorm';

/**
 * Locks a plan row for the rest of the caller's transaction, so a write of the plan and the subscriptions created on
 * it are serialized (Postgres and MySQL; SQLite has a single writer and no row locks):
 *
 * - `update`, held by a plan update across its live-subscription check and its write: a subscription being created
 *   on the plan waits, then sees the plan as it now is (deactivated, re-priced in another currency, recoded).
 * - `share`, held by a subscription creation until it commits: a plan update waits, and its live-subscription check
 *   then counts the new subscription. Shares do not wait for one another, so subscriptions on one plan are still
 *   created side by side.
 *
 * Without it, a plan could be deactivated (or have its currency changed) by an update that counted no live
 * subscription while one was being created on it: the new subscription then ran on an inactive plan, or was priced in
 * a currency the plan no longer had.
 *
 * @param manager The transaction's entity manager.
 * @param planId The plan.
 * @param mode `update` for a write of the plan, `share` for a subscription created on it.
 */
export async function lockPlanRow(manager: EntityManager, planId: ID, mode: 'update' | 'share'): Promise<void> {
	const type = manager.connection?.options?.type;
	if (type !== 'postgres' && type !== 'mysql') {
		return;
	}
	const name = (identifier: string) => (type === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`);
	const clause = mode === 'update' ? 'FOR UPDATE' : type === 'mysql' ? 'LOCK IN SHARE MODE' : 'FOR SHARE';
	const placeholder = type === 'postgres' ? '$1' : '?';
	await manager.query(
		`SELECT ${name('id')} FROM ${name('subscription_plan')} WHERE ${name('id')} = ${placeholder} ${clause}`,
		[planId]
	);
}
