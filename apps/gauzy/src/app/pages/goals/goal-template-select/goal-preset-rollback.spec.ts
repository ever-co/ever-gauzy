import { GoalPresetRollback } from './goal-preset-rollback';

describe('GoalPresetRollback', () => {
	it('removes nothing when nothing was created', async () => {
		await expect(new GoalPresetRollback().undo()).resolves.toEqual([]);
	});

	it('removes the records newest first: the objective before the KPIs its key results link to', async () => {
		const removed: string[] = [];
		const rollback = new GoalPresetRollback();
		rollback.add('KPI 1', async () => removed.push('kpi-1'));
		rollback.add('KPI 2', async () => removed.push('kpi-2'));
		rollback.add('Objective', async () => removed.push('goal'));

		await expect(rollback.undo()).resolves.toEqual([]);

		expect(removed).toEqual(['goal', 'kpi-2', 'kpi-1']);
	});

	it('keeps removing after a removal fails, and names what is left, in creation order', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const removed: string[] = [];
			const rollback = new GoalPresetRollback();
			rollback.add('KPI 1', async () => {
				throw new Error('offline');
			});
			rollback.add('KPI 2', async () => removed.push('kpi-2'));
			rollback.add('Objective', async () => {
				throw new Error('offline');
			});

			await expect(rollback.undo()).resolves.toEqual(['KPI 1', 'Objective']);

			expect(removed).toEqual(['kpi-2']);
			expect(consoleError).toHaveBeenCalledTimes(2);
		} finally {
			consoleError.mockRestore();
		}
	});

	it('names a record whose delete matched no row as left behind', async () => {
		const rollback = new GoalPresetRollback();
		rollback.add('KPI 1', async () => ({ raw: [], affected: 0 }));
		rollback.add('KPI 2', async () => ({ raw: [], affected: 1 }));
		rollback.add('Objective', async () => undefined);

		await expect(rollback.undo()).resolves.toEqual(['KPI 1']);
	});

	it('removes each record once', async () => {
		const remove = jest.fn(async () => undefined);
		const rollback = new GoalPresetRollback();
		rollback.add('KPI 1', remove);

		await rollback.undo();
		await rollback.undo();

		expect(remove).toHaveBeenCalledTimes(1);
	});
});
