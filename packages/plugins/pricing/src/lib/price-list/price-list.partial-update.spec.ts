import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceListStatus, PriceListType } from '../pricing.types';
import { PriceListService } from './price-list.service';

/**
 * R2-30 (F12): a price-list update is partial, as its DTO says.
 *
 * `UpdatePriceListDTO` is the `PartialType` of the list, but the update validated the payload as a whole
 * list: a `PUT` that only moved a priority was refused with `PRICE_LIST_NAME_REQUIRED`. Two more rules
 * of the same update are pinned here: a window bound the caller clears with `null` is cleared (it used
 * to be read as "keep the stored value"), and publishing a list by setting `status: ACTIVE` is refused
 * when its window has closed, exactly as `activate` refuses it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const LIST = '00000000-0000-4000-8000-000000000120';
const AT = new Date('2026-01-15T12:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');
const NEXT_YEAR = new Date('2027-06-01T00:00:00.000Z');

interface IListRow {
	id: string;
	tenantId: string;
	organizationId: string;
	name: string;
	code: string;
	type: PriceListType;
	status: PriceListStatus;
	priority: number;
	startsAt?: Date | null;
	endsAt?: Date | null;
}

const priceList = (overrides: Partial<IListRow> = {}): IListRow => ({
	id: LIST,
	tenantId: TENANT,
	organizationId: ORG,
	name: 'Summer sale',
	code: 'SUMMER',
	type: PriceListType.SALE,
	status: PriceListStatus.DRAFT,
	priority: 0,
	...overrides
});

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		if (expected instanceof FindOperator) {
			throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
		}

		return expected === undefined || same(expected, fields[field]);
	});
}

function serviceUnderTest(lists: IListRow[]) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			lists.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			lists.find((row) => matches(row, options?.where)) ?? null,
		findOneBy: async (where?: Record<string, unknown>) => lists.find((row) => matches(row, where)) ?? null,
		// The statement the platform's update issues: a criteria object, and the partial written as given
		// — `undefined` members skipped, `null` members written.
		update: async (criteria: string | Record<string, unknown>, partial: Record<string, unknown>) => {
			const where = typeof criteria === 'string' ? { id: criteria } : criteria;
			const rows = lists.filter((row) => matches(row, where));

			for (const row of rows) {
				for (const [field, value] of Object.entries(partial)) {
					if (value !== undefined) {
						(row as unknown as Record<string, unknown>)[field] = value;
					}
				}
			}

			return { affected: rows.length };
		}
	};

	return new PriceListService(repository as never, {} as never, {} as never);
}

describe('PriceListService.updateOne — a partial update (R2-30)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.useFakeTimers({ now: AT });
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('changes a priority without restating the name and the code', async () => {
		const lists = [priceList()];

		await serviceUnderTest(lists).updateOne(LIST, { priority: 5 });

		expect(lists[0]).toMatchObject({ priority: 5, name: 'Summer sale', code: 'SUMMER' });
	});

	it('clears a window bound the caller sets to null', async () => {
		const lists = [priceList({ endsAt: NEXT_YEAR })];

		await serviceUnderTest(lists).updateOne(LIST, { endsAt: null } as never);

		expect(lists[0].endsAt).toBeNull();
	});

	it('refuses to publish a list through an update once its window has closed, as activate does', async () => {
		const lists = [priceList({ endsAt: LAST_YEAR })];

		await expect(serviceUnderTest(lists).updateOne(LIST, { status: PriceListStatus.ACTIVE })).rejects.toThrow(
			/PRICE_LIST_WINDOW_CLOSED/
		);
		expect(lists[0].status).toBe(PriceListStatus.DRAFT);
	});

	it('publishes a list through an update while its window is open (control)', async () => {
		const lists = [priceList({ endsAt: NEXT_YEAR })];

		await serviceUnderTest(lists).updateOne(LIST, { status: PriceListStatus.ACTIVE });

		expect(lists[0].status).toBe(PriceListStatus.ACTIVE);
	});
});
