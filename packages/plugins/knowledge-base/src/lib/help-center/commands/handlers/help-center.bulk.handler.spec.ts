import { HelpCenterUpdateCommand } from '../help-center.bulk.command';
import { HelpCenterUpdateHandler } from './help-center.bulk.handler';

/**
 * Reordering help center categories updated each node's index, then saved the nodes read BEFORE those
 * updates, which wrote every old index back: the reorder answered 201 and never stuck.
 */
describe('HelpCenterUpdateHandler', () => {
	const stored = () => [
		{ id: 'a', index: 0 },
		{ id: 'b', index: 1 },
		{ id: 'c', index: 2 }
	];

	const reorder = async (oldChildren: { id: string }[], newChildren: { id: string }[]) => {
		let rows = stored();
		const service = {
			getAllNodes: jest.fn(async () => rows.map((row) => ({ ...row }))),
			update: jest.fn(async (id: string, input: { index: number }) => {
				rows = rows.map((row) => (row.id === id ? { ...row, ...input } : row));
			}),
			// Saving full rows writes their values back, as `saveMany` does
			updateBulk: jest.fn(async (input: { id: string; index: number }[]) => {
				rows = rows.map((row) => input.find(({ id }) => id === row.id) ?? row);
				return input;
			})
		};
		const handler = new HelpCenterUpdateHandler(service as any);
		const result = await handler.execute(new HelpCenterUpdateCommand(oldChildren as any, newChildren as any));
		return { rows, result };
	};

	it('keeps the new order', async () => {
		const { rows, result } = await reorder(
			[{ id: 'a' }, { id: 'b' }, { id: 'c' }],
			[{ id: 'b' }, { id: 'c' }, { id: 'a' }]
		);

		expect(rows).toEqual([
			{ id: 'a', index: 2 },
			{ id: 'b', index: 0 },
			{ id: 'c', index: 1 }
		]);
		expect(result).toEqual(rows);
	});
});
