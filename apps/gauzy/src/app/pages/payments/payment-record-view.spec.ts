import { runInThisContext } from 'node:vm';
import * as moment from 'moment';
import { IPayment } from '@gauzy/contracts';
import { PaymentService } from '@gauzy/ui-core/core';
import { IRecordViewScope } from '@gauzy/ui-core/shared';
import { loadContactMonthsPayments, loadMonthPayments, loadPaymentNeighbours } from './payment-record-view';

// Jest hands each test file a copy of process.env, where TZ changes nothing. The zone is set on the real process,
// reached through node:vm (Node re-reads TZ on assignment), and put back after the suite.
const realProcess = runInThisContext('process') as NodeJS.Process;

/**
 * The payment charts group payments by local month (`categoryMonthBars`, `monthShareOf`), and the payment form saves
 * local midnight. Their reads must ask for the same local months: under UTC the old UTC months and the local ones are
 * the same, so these cases run east of UTC, in Dubai (UTC+4 all year, no daylight saving to blur the bounds).
 */
describe('payment chart reads east of UTC', () => {
	const scope = { organizationId: 'org-1', tenantId: 'tenant-1' } as IRecordViewScope;
	let savedZone: string | undefined;

	beforeAll(() => {
		savedZone = realProcess.env.TZ;
		realProcess.env.TZ = 'Asia/Dubai';
	});

	afterAll(() => {
		if (savedZone === undefined) {
			delete realProcess.env.TZ;
		} else {
			realProcess.env.TZ = savedZone;
		}
	});

	function recordingService(): { service: PaymentService; queries: Array<{ where: Record<string, unknown> }> } {
		const queries: Array<{ where: Record<string, unknown> }> = [];
		const service = {
			pagination: jest.fn(async (query: { where: Record<string, unknown> }) => {
				queries.push(query);
				return { items: [], total: 0 };
			})
		} as unknown as PaymentService;
		return { service, queries };
	}

	/** Saved by the form at local midnight on 1 May 2026: 30 April 20:00 in UTC. */
	function paymentOnTheFirstOfMay(): IPayment {
		return { id: 'payment-1', paymentDate: new Date(2026, 4, 1), currency: 'EUR' } as IPayment;
	}

	it('reads the payment month as the local month, not the UTC month it starts in', async () => {
		const { service, queries } = recordingService();

		await loadMonthPayments(service, scope, paymentOnTheFirstOfMay());

		expect(queries).toHaveLength(1);
		expect(queries[0].where).toMatchObject({
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			currency: 'EUR',
			// Local May, sent in UTC: from 1 May 00:00 (+04:00) to 31 May 23:59:59 (+04:00).
			paymentDate: { startDate: '2026-04-30 20:00:00', endDate: '2026-05-31 19:59:59' }
		});
	});

	it('reads the contact chart months as local months ending with the payment month', async () => {
		const { service, queries } = recordingService();

		await loadContactMonthsPayments(service, scope, paymentOnTheFirstOfMay(), 3);

		expect(queries).toHaveLength(1);
		expect(queries[0].where).toMatchObject({
			currency: 'EUR',
			// Local March to local May, sent in UTC.
			paymentDate: { startDate: '2026-02-28 20:00:00', endDate: '2026-05-31 19:59:59' }
		});
	});
});

describe('the contact chart read', () => {
	it('keeps the contact filter in the read, ahead of the page ceiling', async () => {
		const queries: Array<{ where: Record<string, unknown>; relations?: string[] }> = [];
		const service = {
			pagination: jest.fn(async (query: { where: Record<string, unknown>; relations?: string[] }) => {
				queries.push(query);
				return { items: [], total: 0 };
			})
		} as unknown as PaymentService;
		const payment = { id: 'p', paymentDate: new Date(2026, 4, 2), currency: 'EUR', organizationContactId: 'c-1' };

		await loadContactMonthsPayments(service, SCOPE, payment as IPayment, 3);

		// Filtered by the server: the 2,000-payment ceiling counts this contact's payments, not the organization's.
		expect(queries[0].where).toMatchObject({ organizationContactId: 'c-1', currency: 'EUR' });
	});
});

/**
 * The payments endpoint as the neighbour reads meet it: `Between` on whole-second bounds, both ends included, the
 * requested order keys only (a tie the query leaves open keeps the table's order), and `take` rows of page `skip` (counted from 1).
 */
function endpointOver(rows: IPayment[]): PaymentService {
	const at = (value: Date | string | undefined) => (value ? new Date(value).getTime() : 0);
	return {
		pagination: jest.fn(
			async (query: {
				where: { paymentDate: { startDate: string; endDate: string } };
				order?: { paymentDate?: 'ASC' | 'DESC'; createdAt?: 'ASC' | 'DESC'; id?: 'ASC' | 'DESC' };
				take?: number;
				skip?: number;
			}) => {
				const low = moment.utc(query.where.paymentDate.startDate, 'YYYY-MM-DD HH:mm:ss').valueOf();
				const high = moment.utc(query.where.paymentDate.endDate, 'YYYY-MM-DD HH:mm:ss').valueOf();
				const direction = query.order?.paymentDate === 'DESC' ? -1 : 1;
				const matching = rows
					.filter((row) => at(row.paymentDate) >= low && at(row.paymentDate) <= high)
					// Only the keys the query names order the rows; a tie it leaves open keeps the table's order.
					.sort(
						(a, b) =>
							direction *
							(at(a.paymentDate) - at(b.paymentDate) ||
								(query.order?.createdAt ? at(a.createdAt) - at(b.createdAt) : 0) ||
								(query.order?.id ? String(a.id).localeCompare(String(b.id)) : 0))
					);
				const take = query.take ?? matching.length;
				const page = query.skip ?? 1;
				return { items: matching.slice((page - 1) * take, page * take), total: matching.length };
			}
		)
	} as unknown as PaymentService;
}

const SCOPE = { organizationId: 'org-1', tenantId: 'tenant-1' } as IRecordViewScope;

describe('the neighbour reads', () => {
	const row = (id: string, paymentDate: string, createdAt = paymentDate) =>
		({ id, paymentDate: new Date(paymentDate), createdAt: new Date(createdAt) }) as IPayment;

	it('find the payments a part of a second away', async () => {
		const payment = row('current', '2026-05-01T10:00:05.300Z');
		const service = endpointOver([
			row('far-before', '2026-05-01T09:00:00.000Z'),
			row('just-before', '2026-05-01T10:00:04.700Z'),
			payment,
			row('just-after', '2026-05-01T10:00:05.700Z'),
			row('far-after', '2026-05-01T11:00:00.000Z')
		]);

		const { previous, next } = await loadPaymentNeighbours(service, SCOPE, payment);

		expect(previous?.id).toBe('just-before');
		expect(next?.id).toBe('just-after');
	});

	it('keep the previous payment when many share the second of the current one', async () => {
		// The current payment was recorded first of eleven at midnight; yesterday's payment comes right before it.
		const payment = row('current', '2026-05-01T00:00:00.000Z', '2026-05-01T08:00:00.000Z');
		const sameMidnight = Array.from({ length: 10 }, (_, index) =>
			row(`midnight-${index}`, '2026-05-01T00:00:00.000Z', `2026-05-01T09:0${index}:00.000Z`)
		);
		const service = endpointOver([row('yesterday', '2026-04-30T09:00:00.000Z'), payment, ...sameMidnight]);

		const { previous, next } = await loadPaymentNeighbours(service, SCOPE, payment);

		expect(previous?.id).toBe('yesterday');
		expect(next?.id).toBe('midnight-0');
	});

	it('stay answerable when thousands of payments sit in the second before', async () => {
		// 2,000 payments at midnight and this one a second later: more than a full read takes, so the second before
		// is read nearest first instead.
		const payment = row('current', '2026-05-01T00:00:01.300Z');
		const midnight = Array.from({ length: 2000 }, (_, index) =>
			row(
				`midnight-${String(index).padStart(4, '0')}`,
				'2026-05-01T00:00:00.000Z',
				`2026-05-01T08:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`
			)
		);
		const service = endpointOver([...midnight, payment]);

		const { previous, next } = await loadPaymentNeighbours(service, SCOPE, payment);

		expect(previous?.id).toBe('midnight-1999');
		expect(next).toBeNull();
	});

	it('find a payment a part of a second earlier behind many on the same second', async () => {
		const payment = row('current', '2026-05-01T00:00:00.000Z', '2026-05-01T08:00:00.000Z');
		const sameSecond = Array.from({ length: 150 }, (_, index) =>
			row(
				`same-${String(index).padStart(3, '0')}`,
				'2026-05-01T00:00:00.000Z',
				`2026-05-01T09:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`
			)
		);
		const service = endpointOver([
			row('yesterday', '2026-04-30T09:00:00.000Z'),
			row('half-second-before', '2026-04-30T23:59:59.500Z'),
			payment,
			...sameSecond
		]);

		const { previous, next } = await loadPaymentNeighbours(service, SCOPE, payment);

		expect(previous?.id).toBe('half-second-before');
		expect(next?.id).toBe('same-000');
	});

	it('keep the right payment when a page boundary falls inside a tie', async () => {
		// 101 payments half a second before this one, recorded at the same moment: only the id orders them, and the
		// nearest (the last in the page's order) must not be left on a second page.
		const payment = row('current', '2026-05-01T10:00:05.300Z');
		const tied = Array.from({ length: 101 }, (_, index) =>
			row(`tied-${String(index).padStart(3, '0')}`, '2026-05-01T10:00:04.500Z', '2026-05-01T08:00:00.000Z')
		);
		const service = endpointOver([...tied, payment]);

		const { previous } = await loadPaymentNeighbours(service, SCOPE, payment);

		expect(previous?.id).toBe('tied-100');
	});
});
