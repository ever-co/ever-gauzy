/**
 * The statements a campaign ceiling is enforced with, as MikroORM sends them to Postgres (#10678).
 *
 * MikroORM's `Connection.execute()` fills the values into the statement itself, looking for `?` on every
 * dialect, and sends it with no bindings. The service used to hand it the placeholders the Postgres driver
 * binds, `$1, $2, …`, which reached Postgres unbound: every reserve, release and reset failed with "there is
 * no parameter $1". The dialect is read from the environment at import time, so it is mocked here.
 */
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false,
	isSqlite: () => false
}));

import { MultiORMEnum } from '@gauzy/core';
import { CampaignBudgetService } from './campaign-budget.service';

/** A statement the service binds the same name in twice, as the conditional increment does. */
const INCREMENT =
	'UPDATE "campaign_budget" SET "used" = "used" + :amount WHERE "used" + :amount <= "limit" AND "id" = :id';

function serviceOn(ormType: MultiORMEnum) {
	const executed: Array<{ sql: string; parameters: unknown[]; method?: string }> = [];
	const queried: Array<{ sql: string; parameters: unknown[] }> = [];

	const mikroOrmRepository = {
		getEntityManager: () => ({
			getConnection: () => ({
				execute: async (sql: string, parameters: unknown[], method?: string) => {
					executed.push({ sql, parameters, method });
					return 1;
				}
			})
		})
	};
	const typeOrmRepository = {
		query: async (sql: string, parameters: unknown[]) => {
			queried.push({ sql, parameters });
			return [[], 1];
		}
	};

	const service = new CampaignBudgetService(typeOrmRepository as never, mikroOrmRepository as never, {} as never);
	Object.defineProperty(service, 'ormType', { get: () => ormType });

	/** The private seam every ceiling statement goes through. */
	const execute = (sql: string, parameters: Record<string, unknown>): Promise<number> =>
		(service as unknown as { execute: typeof execute }).execute(sql, parameters);

	return { execute, executed, queried };
}

describe('CampaignBudgetService statements on Postgres', () => {
	it('hands MikroORM ? placeholders, one value per occurrence, in order', async () => {
		const { execute, executed } = serviceOn(MultiORMEnum.MikroORM);

		await expect(execute(INCREMENT, { amount: 5, id: 'budget-1' })).resolves.toBe(1);

		expect(executed).toEqual([
			{
				sql: 'UPDATE "campaign_budget" SET "used" = "used" + ? WHERE "used" + ? <= "limit" AND "id" = ?',
				parameters: [5, 5, 'budget-1'],
				method: 'run'
			}
		]);
		expect(executed[0].sql).not.toMatch(/\$\d/);
	});

	it('still hands TypeORM the $n placeholders pg binds — control', async () => {
		const { execute, queried } = serviceOn(MultiORMEnum.TypeORM);

		await execute(INCREMENT, { amount: 5, id: 'budget-1' });

		expect(queried).toEqual([
			{
				sql: 'UPDATE "campaign_budget" SET "used" = "used" + $1 WHERE "used" + $2 <= "limit" AND "id" = $3',
				parameters: [5, 5, 'budget-1']
			}
		]);
	});
});
