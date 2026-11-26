import { runInThisContext } from 'node:vm';
import { IPayment } from '@gauzy/contracts';
import { PaymentService } from '@gauzy/ui-core/core';
import { IRecordViewScope } from '@gauzy/ui-core/shared';
import { loadContactMonthsPayments, loadMonthPayments } from './payment-record-view';

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
