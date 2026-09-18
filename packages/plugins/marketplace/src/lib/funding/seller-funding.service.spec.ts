/**
 * The funding reader, exercised over the ledger rows it reads.
 *
 * `@gauzy/core` boots the whole application graph from its barrel, so the boundary is doubled here the
 * way the package's other suites double it — while the money layer the reader sums with stays **the real
 * one**, because every assertion below is about an amount and a double that rounded differently would
 * make the suite agree with a defect. `@gauzy/config` is read at import time by other packages of the
 * workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	const decimal = jest.requireActual('@gauzy/core/src/lib/money/decimal');

	return {
		// The kernel's ledger service, doubled: what this suite is about is which rows the reader counts
		// and how it adds them, not how the ledger is queried.
		AdjustmentService: class AdjustmentService {},
		// The whole money layer the reader uses, taken from the platform rather than restated: the sums are
		// exact scaled-integer additions, and a stub would hide a rounding defect rather than show it.
		addDecimalStrings: decimal.addDecimalStrings,
		formatDecimalUnits: decimal.formatDecimalUnits,
		toUnitsAtScale: decimal.toUnitsAtScale,
		STORAGE_SCALE: decimal.STORAGE_SCALE
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

import { AdjustmentFunding, AdjustmentOwnerType } from '@gauzy/contracts';
import { SellerFundingService } from './seller-funding.service';

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const SELLER = 'seller-1';
const OTHER_SELLER = 'seller-2';

type Row = Record<string, any>;

/** One `adjustment` row as the ledger holds it. */
const adjustmentRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	ownerType: AdjustmentOwnerType.ORDER_LINE,
	ownerId: 'line-1',
	amount: '-5.000000',
	currency: 'USD',
	fundedBy: AdjustmentFunding.PLATFORM,
	sellerId: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/** The service under test, over the rows the kernel's ledger service double answers with. */
function fixture(rows: Row[]) {
	const calls: Row[] = [];
	const adjustmentService = {
		findByOwner: async (ownerType: string, ownerId: string) => {
			calls.push({ ownerType, ownerId });

			return rows.filter((row) => row.ownerId === ownerId);
		}
	};
	const service = new SellerFundingService(adjustmentService as never);

	return { service, calls };
}

describe('SellerFundingService — the discounts a line carries, split by who bore them', () => {
	it('answers a zero for every line, including one the ledger holds no row for', async () => {
		const { service } = fixture([]);

		const funded = await service.fundingByOrderLine(['line-1', 'line-2']);

		expect([...funded.keys()]).toEqual(['line-1', 'line-2']);
		expect(funded.get('line-1')).toEqual({
			orderLineId: 'line-1',
			sellerDiscountAmount: '0.000000',
			platformDiscountAmount: '0.000000'
		});
	});

	it('keeps the two funders apart, which is the whole reason the reader exists', async () => {
		// The platform's discount and the seller's are recorded on the same line and must never be added
		// together: the first is one the seller is made whole for and the second is one it bears.
		const { service } = fixture([
			adjustmentRow('a1', { ownerId: 'line-1', amount: '-5.590000', fundedBy: AdjustmentFunding.PLATFORM }),
			adjustmentRow('a2', {
				ownerId: 'line-1',
				amount: '-2.000000',
				fundedBy: AdjustmentFunding.SELLER,
				sellerId: SELLER
			})
		]);

		const funded = await service.fundingByOrderLine(['line-1']);

		expect(funded.get('line-1')).toEqual({
			orderLineId: 'line-1',
			sellerDiscountAmount: '-2.000000',
			platformDiscountAmount: '-5.590000'
		});
	});

	it('sums several rows of one funder exactly, at the storage scale', async () => {
		const { service } = fixture([
			adjustmentRow('a1', { ownerId: 'line-1', amount: '-1.234567', fundedBy: AdjustmentFunding.SELLER, sellerId: SELLER }),
			adjustmentRow('a2', { ownerId: 'line-1', amount: '-2.000001', fundedBy: AdjustmentFunding.SELLER, sellerId: SELLER }),
			adjustmentRow('a3', { ownerId: 'line-1', amount: '-0.000001', fundedBy: AdjustmentFunding.SELLER, sellerId: SELLER })
		]);

		const funded = await service.fundingByOrderLine(['line-1']);

		// `1.234567 + 2.000001 + 0.000001` is a sum no `number` would hold exactly.
		expect(funded.get('line-1')?.sellerDiscountAmount).toBe('-3.234569');
	});

	it('refuses a seller-funded row that names no seller rather than billing the platform for it', async () => {
		const { service } = fixture([
			adjustmentRow('a1', { amount: '-4.000000', fundedBy: AdjustmentFunding.SELLER, sellerId: null })
		]);

		await expect(service.fundingByOrderLine(['line-1'])).rejects.toThrow(
			/^ADJUSTMENT_FUNDING_SELLER_MISSING/
		);
	});
});

describe('SellerFundingService — one seller’s own funding across an order', () => {
	it('counts the seller’s rows and the platform’s, and nobody else’s', async () => {
		const { service } = fixture([
			adjustmentRow('a1', { amount: '-3.000000', fundedBy: AdjustmentFunding.SELLER, sellerId: SELLER }),
			adjustmentRow('a2', { amount: '-9.000000', fundedBy: AdjustmentFunding.SELLER, sellerId: OTHER_SELLER }),
			adjustmentRow('a3', { amount: '-2.500000', fundedBy: AdjustmentFunding.PLATFORM })
		]);

		const summary = await service.fundingSummary(['line-1'], SELLER);

		expect(summary).toEqual({
			sellerDiscountAmount: '-3.000000',
			platformDiscountAmount: '-2.500000',
			sellerRowCount: 1,
			platformRowCount: 1
		});
	});

	it('asks the ledger only for the lines it was given, and only for their own rows', async () => {
		const { service, calls } = fixture([]);

		await service.fundingSummary(['line-1', 'line-2'], SELLER);

		expect(calls).toEqual([
			{ ownerType: AdjustmentOwnerType.ORDER_LINE, ownerId: 'line-1' },
			{ ownerType: AdjustmentOwnerType.ORDER_LINE, ownerId: 'line-2' }
		]);
	});
});
