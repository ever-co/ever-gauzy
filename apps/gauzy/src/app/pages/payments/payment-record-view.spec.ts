import { runInThisContext } from 'node:vm';
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
	const scope = { organizationId: 'org-1', tenantId: 'tenant-1' } as IRecordViewScope;

	it('counts a payment whose contact is only known through its invoice', async () => {
		// Recorded from an invoice before the record form saved its contact: no contact of its own.
		const older = {
			id: 'older',
			paymentDate: new Date(2026, 3, 10),
			currency: 'EUR',
			invoice: { toContactId: 'c-1' }
		};
		const own = { id: 'own', paymentDate: new Date(2026, 4, 2), currency: 'EUR', organizationContactId: 'c-1' };
		const other = { id: 'other', paymentDate: new Date(2026, 4, 3), currency: 'EUR', organizationContactId: 'c-2' };
		const queries: Array<{ where: Record<string, unknown>; relations?: string[] }> = [];
		const service = {
			pagination: jest.fn(async (query: { where: Record<string, unknown>; relations?: string[] }) => {
				queries.push(query);
				return { items: [older, own, other], total: 3 };
			})
		} as unknown as PaymentService;
		const payment = { id: 'own', paymentDate: new Date(2026, 4, 2), currency: 'EUR', organizationContactId: 'c-1' };

		const payments = await loadContactMonthsPayments(service, scope, payment as IPayment, 3);

		// The contact is matched on the answer (through the invoice when needed), so the read names no contact and
		// brings the invoice along.
		expect(queries[0].where).not.toHaveProperty('organizationContactId');
		expect(queries[0].relations).toEqual(['invoice']);
		expect(payments.map((item) => item.id)).toEqual(['older', 'own']);
	});
});

describe('the neighbour reads', () => {
	const scope = { organizationId: 'org-1', tenantId: 'tenant-1' } as IRecordViewScope;

	it('read the whole current second around a payment date with milliseconds', async () => {
		const bounds: Array<{ startDate: string; endDate: string }> = [];
		const service = {
			pagination: jest.fn(async (query: { where: { paymentDate: { startDate: string; endDate: string } } }) => {
				bounds.push(query.where.paymentDate);
				return { items: [], total: 0 };
			})
		} as unknown as PaymentService;
		const payment = { id: 'p', paymentDate: new Date('2026-05-01T10:00:05.300Z') } as IPayment;

		await loadPaymentNeighbours(service, scope, payment);

		expect(bounds).toEqual(
			expect.arrayContaining([
				// The same date: the whole of 10:00:05, so 10:00:05.700 is read.
				{ startDate: '2026-05-01 10:00:05', endDate: '2026-05-01 10:00:06' },
				// Before: up to 10:00:05, so 10:00:04.700 is read.
				{ startDate: '1970-01-01 00:00:00', endDate: '2026-05-01 10:00:05' },
				// After: from the next second.
				{ startDate: '2026-05-01 10:00:06', endDate: '9999-12-31 23:59:59' }
			])
		);
	});
});
