/**
 * `?withDeleted=false` on the inventory list routes, as the handler really receives it.
 *
 * The eight list routes below declare their query as a `*QueryDTO` whose `withDeleted` carries a
 * `@Transform` from the query string to a boolean. No validation pipe runs on any of them, and the
 * application registers none globally, so that transform never executes: the handler is handed the raw
 * value the query-string parser produced, and for `?withDeleted=false` that is the non-empty — truthy —
 * string `'false'`. Each handler tested the flag for truthiness, so a client whose "show retired" toggle was
 * off was answered the soft-deleted rows, and a `total` that counted them, on both ORMs.
 *
 * The handlers here are the real ones, driven with exactly what Nest hands them — a plain object of
 * strings — over a service stub that records the options its paged read was given. `@gauzy/core` is the
 * real barrel, as it is in `graphql/write-routes.spec.ts`: the controllers are built from the kernel's own
 * decorators, and nothing here needs the application to boot.
 */

import { ChannelWarehouseController } from './channel-warehouse/channel-warehouse.controller';
import { isQueryFlagSet } from './inventory.query';
import { StockAdjustmentController } from './stock-adjustment/stock-adjustment.controller';
import { StockAlertController } from './stock-alert/stock-alert.controller';
import { StockCountLineController } from './stock-count-line/stock-count-line.controller';
import { StockCountController } from './stock-count/stock-count.controller';
import { StockReservationController } from './stock-reservation/stock-reservation.controller';
import { StockTransferLineController } from './stock-transfer-line/stock-transfer-line.controller';
import { StockTransferController } from './stock-transfer/stock-transfer.controller';

/** One list route: the controller, and the service read its handler delegates to. */
interface IRoute {
	readonly route: string;
	readonly build: (service: Record<string, jest.Mock>) => { findAll(filter: unknown): Promise<unknown> };
	readonly read: string;
}

const ROUTES: readonly IRoute[] = [
	{ route: 'GET /stock-alerts', build: (s) => new StockAlertController(s as never), read: 'findAlerts' },
	{ route: 'GET /stock-transfers', build: (s) => new StockTransferController(s as never), read: 'findTransfers' },
	{
		route: 'GET /stock-reservations',
		build: (s) => new StockReservationController(s as never),
		read: 'findReservations'
	},
	{ route: 'GET /stock-counts', build: (s) => new StockCountController(s as never), read: 'findCounts' },
	{ route: 'GET /stock-count-lines', build: (s) => new StockCountLineController(s as never), read: 'findLines' },
	{
		route: 'GET /stock-transfer-lines',
		build: (s) => new StockTransferLineController(s as never),
		read: 'findLines'
	},
	{
		route: 'GET /channel-warehouses',
		build: (s) => new ChannelWarehouseController(s as never),
		read: 'findAssignments'
	},
	{
		route: 'GET /stock-adjustments',
		build: (s) => new StockAdjustmentController(s as never),
		read: 'findAdjustments'
	}
];

/**
 * @param route The route to drive.
 * @param query The query object, as Nest hands it to a handler with no pipe: every value a string.
 * @returns The options the handler gave the service's paged read.
 */
async function optionsFor(route: IRoute, query: Record<string, string>): Promise<Record<string, unknown>> {
	const read = jest.fn().mockResolvedValue({ items: [], total: 0 });

	await route.build({ [route.read]: read }).findAll(query);

	expect(read).toHaveBeenCalledTimes(1);

	return read.mock.calls[0][0];
}

describe('isQueryFlagSet — a query flag is set only by `true`', () => {
	it.each([
		['true', true],
		['TRUE', true],
		[' true ', true],
		[true, true],
		['false', false],
		['FALSE', false],
		[false, false],
		['', false],
		['0', false],
		['1', false],
		['yes', false],
		[['true', 'false'], false],
		[undefined, false],
		[null, false]
	])('reads %p as %p', (value, expected) => {
		expect(isQueryFlagSet(value)).toBe(expected);
	});
});

describe.each(ROUTES)('$route — `withDeleted` means what the query says', (route) => {
	it('keeps the soft-delete filter for `?withDeleted=false`, rather than reading the string as truthy', async () => {
		const options = await optionsFor(route, { withDeleted: 'false' });

		expect(options).not.toHaveProperty('withDeleted');
		// Nor does the flag leak into the filter: it is a visibility, not a column.
		expect(options.where).not.toHaveProperty('withDeleted');
	});

	it('lifts it for `?withDeleted=true`, and leaves an unflagged read as it was', async () => {
		expect(await optionsFor(route, { withDeleted: 'true' })).toMatchObject({ withDeleted: true });
		expect(await optionsFor(route, {})).not.toHaveProperty('withDeleted');
	});
});
