import { IInvoiceItemCreateInput } from '@gauzy/contracts';
import { IHeldLine, unchangedLinesOf } from './invoice-item-kept-time';

/**
 * Which line of a bulk replacement keeps the time an invoice's line billed (#11854): one that names no time logs and
 * says what the stored line said. The invoice edit screen re-posts every line without `timeLogIds`, so a line it
 * leaves as it was keeps its time and a line it changes releases it.
 */

const INVOICE = '9e5c1a20-0000-4000-8000-00000000a001';
const ORG = '9e5c1a20-0000-4000-8000-00000000b001';
const PROJECT = '9e5c1a20-0000-4000-8000-00000000c001';
const OTHER = '9e5c1a20-0000-4000-8000-00000000f001';
const DESIGN_LOGS = ['9e5c1a20-0000-4000-8000-00000000d001', '9e5c1a20-0000-4000-8000-00000000d002'];
const REVIEW_LOGS = ['9e5c1a20-0000-4000-8000-00000000d003'];

/** A line as the edit screen re-posts it. */
const requested = (changes: Record<string, unknown> = {}): IInvoiceItemCreateInput =>
	({
		description: 'Website',
		price: 80,
		quantity: 10.5,
		totalValue: 840,
		applyTax: true,
		invoiceId: INVOICE,
		organizationId: ORG,
		projectId: PROJECT,
		...changes
	}) as unknown as IInvoiceItemCreateInput;

/** The same line as the database answers it: decimals as text, unset columns as null. */
const held = (timeLogIds: string[], changes: Record<string, unknown> = {}): IHeldLine => ({
	line: {
		id: '9e5c1a20-0000-4000-8000-00000000e001',
		description: 'Website',
		price: '80.00',
		quantity: '10.5',
		totalValue: '840',
		applyTax: true,
		applyDiscount: null,
		invoiceId: INVOICE,
		organizationId: ORG,
		projectId: PROJECT,
		employeeId: null,
		taskId: null,
		productId: null,
		expenseId: null,
		purchaseOrderLineId: null,
		...changes
	},
	timeLogIds
});

describe('unchangedLinesOf', () => {
	it('pairs a re-posted line with the stored line it repeats, whatever form the database gives its values', () => {
		expect(unchangedLinesOf([requested()], [held(DESIGN_LOGS)])).toEqual([{ index: 0, timeLogIds: DESIGN_LOGS }]);
	});

	it.each<[string, Record<string, unknown>]>([
		['text', { description: 'Website, Ada' }],
		['quantity', { quantity: 8 }],
		['tax switch', { applyTax: false }],
		['invoice', { invoiceId: OTHER }],
		['organization', { organizationId: OTHER }],
		['project', { projectId: OTHER }],
		['employee, which it did not name before', { employeeId: OTHER }]
	])('gives no time to a line whose %s changed', (_label, changes) => {
		expect(unchangedLinesOf([requested(changes)], [held(DESIGN_LOGS)])).toEqual([]);
	});

	it.each<[string, Record<string, unknown>]>([
		['some time logs', { timeLogIds: REVIEW_LOGS }],
		['an empty list of time logs', { timeLogIds: [] }]
	])('leaves a line that names %s to bill what it names', (_label, changes) => {
		expect(unchangedLinesOf([requested(changes)], [held(DESIGN_LOGS)])).toEqual([]);
	});

	it('pairs each stored line once, in the order of the request', () => {
		const lines = [requested(), requested({ description: 'Hosting' }), requested(), requested()];

		const pairs = unchangedLinesOf(lines, [held(DESIGN_LOGS), held(REVIEW_LOGS)]);

		expect(pairs).toEqual([
			{ index: 0, timeLogIds: DESIGN_LOGS },
			{ index: 2, timeLogIds: REVIEW_LOGS }
		]);
	});

	it('reads a record from its relation when the stored line answers no id', () => {
		const stored = held(DESIGN_LOGS, {
			projectId: undefined,
			project: { id: PROJECT },
			organizationId: undefined,
			organization: ORG
		});

		expect(unchangedLinesOf([requested()], [stored])).toEqual([{ index: 0, timeLogIds: DESIGN_LOGS }]);
	});
});
