import { BadRequestException } from '@nestjs/common';
import { IInvoice } from '@gauzy/contracts';
import {
	buildInvoiceDuplicate,
	MAX_DUPLICATE_PAYMENT_WINDOW_DAYS,
	paymentWindowDaysOf,
	withLineRelationKeys
} from './invoice-duplicate';
import { InvoiceService } from './invoice.service';

const TENANT = 't-1';
const ORG = 'o-1';
const TODAY = new Date('2026-11-20T10:00:00.000Z');

const source = (overrides: Record<string, unknown> = {}): IInvoice =>
	({
		id: 'source-id',
		tenantId: TENANT,
		organizationId: ORG,
		invoiceNumber: 41,
		invoiceDate: new Date('2026-10-01T00:00:00.000Z'),
		dueDate: new Date('2026-10-31T00:00:00.000Z'),
		currency: 'EUR',
		discountValue: 10,
		discountType: 'PERCENT',
		tax: 20,
		taxType: 'PERCENT',
		tax2: 0,
		tax2Type: 'PERCENT',
		terms: 'Net 30',
		totalValue: 540,
		invoiceType: 'DETAILED_ITEMS',
		isEstimate: false,
		isAccepted: true,
		status: 'FULLY_PAID',
		paid: true,
		alreadyPaid: 540,
		amountDue: 0,
		sentTo: 'client@acme.test',
		token: 'secret-token',
		internalNote: 'repeat customer',
		fromOrganization: { id: ORG },
		toContact: { id: 'contact-1' },
		organizationContactId: 'contact-1',
		paymentTermId: 'term-1',
		vendorId: 'vendor-1',
		tags: [{ id: 'tag-1', name: 'retainer' }],
		payments: [{ id: 'pay-1' }],
		historyRecords: [{ id: 'h-1' }],
		invoiceItems: [
			{
				id: 'line-1',
				invoiceId: 'source-id',
				tenantId: TENANT,
				organizationId: ORG,
				description: 'Design',
				price: 100,
				quantity: 5,
				totalValue: 500,
				applyTax: true,
				applyDiscount: false,
				employeeId: 'emp-1',
				projectId: 'proj-1',
				expenseId: 'exp-1'
			}
		],
		...overrides
	}) as unknown as IInvoice;

describe('buildInvoiceDuplicate', () => {
	it('makes a draft of the given number, dated today, with the source payment window', () => {
		const copy = buildInvoiceDuplicate(source(), { invoiceNumber: 42, today: TODAY });

		expect(copy.invoiceNumber).toBe(42);
		expect(copy.status).toBe('DRAFT');
		expect(copy.invoiceDate).toEqual(TODAY);
		expect(copy.dueDate).toEqual(new Date('2026-12-20T10:00:00.000Z'));
	});

	it('keeps what describes the bill: contact, currency, taxes, discount, terms, payment term, vendor, tags, lines', () => {
		const copy = buildInvoiceDuplicate(source(), { invoiceNumber: 42, today: TODAY });

		expect(copy).toMatchObject({
			tenantId: TENANT,
			organizationId: ORG,
			fromOrganizationId: ORG,
			toContactId: 'contact-1',
			organizationContactId: 'contact-1',
			currency: 'EUR',
			discountValue: 10,
			discountType: 'PERCENT',
			tax: 20,
			taxType: 'PERCENT',
			terms: 'Net 30',
			totalValue: 540,
			invoiceType: 'DETAILED_ITEMS',
			internalNote: 'repeat customer',
			paymentTermId: 'term-1',
			vendorId: 'vendor-1',
			tags: [{ id: 'tag-1' }]
		});
		expect(copy.invoiceItems).toEqual([
			{
				tenantId: TENANT,
				organizationId: ORG,
				description: 'Design',
				price: 100,
				quantity: 5,
				totalValue: 500,
				applyTax: true,
				applyDiscount: false,
				employeeId: 'emp-1',
				projectId: 'proj-1'
			}
		]);
	});

	it("reads each line's links from the mirror or from the relation, and states the mirror", () => {
		const copy = buildInvoiceDuplicate(
			source({
				invoiceItems: [
					{
						tenantId: TENANT,
						organizationId: ORG,
						description: 'Kit',
						price: 1,
						quantity: 1,
						totalValue: 1,
						task: { id: 'task-1' },
						product: { id: 'prod-1' }
					}
				]
			}),
			{ invoiceNumber: 42, today: TODAY }
		);

		expect(copy.invoiceItems[0]).toMatchObject({ taskId: 'task-1', productId: 'prod-1' });
		for (const relation of ['task', 'product', 'employee', 'project']) {
			expect(copy.invoiceItems[0]).not.toHaveProperty(relation);
		}
	});

	it("states each line's links and scope by their relation keys too, for MikroORM, leaving the copy it is given as it is", () => {
		const copy = buildInvoiceDuplicate(source(), { invoiceNumber: 42, today: TODAY });

		const stated = withLineRelationKeys(copy);

		expect(stated.invoiceItems[0]).toMatchObject({
			tenantId: TENANT,
			tenant: TENANT,
			organizationId: ORG,
			organization: ORG,
			employeeId: 'emp-1',
			employee: 'emp-1',
			projectId: 'proj-1',
			project: 'proj-1'
		});
		expect(stated.invoiceItems[0]).not.toHaveProperty('task');
		expect(stated.invoiceItems[0]).not.toHaveProperty('product');
		expect(copy.invoiceItems[0]).not.toHaveProperty('employee');
	});

	it('keeps the contact identifier of a source whose contact relation is gone', () => {
		const copy = buildInvoiceDuplicate(source({ toContact: undefined, organizationContactId: 'contact-9' }), {
			invoiceNumber: 2,
			today: TODAY
		});

		expect(copy.organizationContactId).toBe('contact-9');
		expect(copy).not.toHaveProperty('toContactId');
	});

	it('leaves behind payments, answer, recipient, link, history and what its lines billed', () => {
		const copy = buildInvoiceDuplicate(source(), { invoiceNumber: 42, today: TODAY }) as Record<string, any>;

		expect(copy).toMatchObject({ paid: false, alreadyPaid: 0, amountDue: 540, isAccepted: false });
		for (const key of ['id', 'sentTo', 'token', 'payments', 'historyRecords']) {
			expect(copy).not.toHaveProperty(key);
		}
		for (const line of copy.invoiceItems) {
			expect(line).not.toHaveProperty('id');
			expect(line).not.toHaveProperty('invoiceId');
			expect(line).not.toHaveProperty('expenseId');
			expect(line).not.toHaveProperty('timeLogIds');
		}
		expect(copy.tags[0]).not.toHaveProperty('name');
	});

	it('keeps an estimate an estimate and an invoice an invoice', () => {
		expect(buildInvoiceDuplicate(source({ isEstimate: true }), { invoiceNumber: 2, today: TODAY }).isEstimate).toBe(
			true
		);
		expect(
			buildInvoiceDuplicate(source({ isEstimate: undefined }), { invoiceNumber: 2, today: TODAY }).isEstimate
		).toBe(false);
	});

	it('copies a source without lines, tags, contact or total', () => {
		const copy = buildInvoiceDuplicate(
			source({
				invoiceItems: undefined,
				tags: undefined,
				toContact: undefined,
				organizationContactId: undefined,
				paymentTermId: undefined,
				vendorId: undefined,
				totalValue: undefined
			}),
			{ invoiceNumber: 2, today: TODAY }
		);

		expect(copy.invoiceItems).toEqual([]);
		expect(copy.amountDue).toBe(0);
		expect(copy).not.toHaveProperty('tags');
		expect(copy).not.toHaveProperty('toContactId');
		expect(copy).not.toHaveProperty('organizationContactId');
		expect(copy).not.toHaveProperty('paymentTermId');
		expect(copy).not.toHaveProperty('vendorId');
	});

	it('does not move the date it is given', () => {
		const today = new Date(TODAY);
		buildInvoiceDuplicate(source(), { invoiceNumber: 2, today });
		expect(today).toEqual(TODAY);
	});
});

describe('paymentWindowDaysOf', () => {
	const days = (invoiceDate: unknown, dueDate: unknown) =>
		paymentWindowDaysOf({ invoiceDate, dueDate } as unknown as IInvoice);

	it('counts the days from the date to the due date', () => {
		expect(days('2026-10-01', '2026-10-31')).toBe(30);
	});

	it.each([
		['no due date', '2026-10-01', undefined],
		['no date', undefined, '2026-10-31'],
		['a due date before the date', '2026-10-31', '2026-10-01'],
		['the same day', '2026-10-01', '2026-10-01'],
		['dates that are not dates', 'soon', 'later']
	])('is 0 for %s', (_name, invoiceDate, dueDate) => {
		expect(days(invoiceDate, dueDate)).toBe(0);
	});

	it('is cut at the upper bound', () => {
		expect(days('2026-01-01', '9999-01-01')).toBe(MAX_DUPLICATE_PAYMENT_WINDOW_DAYS);
	});
});

describe('InvoiceService.duplicate', () => {
	let service: InvoiceService;
	let created: jest.SpyInstance;

	beforeEach(() => {
		service = new InvoiceService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);
		jest.spyOn(service, 'findOneByIdString').mockResolvedValue(source() as never);
		created = jest.spyOn(service, 'createWithBilledTime').mockResolvedValue({ id: 'copy' } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	const highest = (max: unknown) =>
		jest.spyOn(service, 'getHighestInvoiceNumber').mockResolvedValue({ max } as never);

	it('creates the copy with the number after the highest of the tenant', async () => {
		highest(41);
		await expect(service.duplicate('source-id')).resolves.toEqual({ id: 'copy' });
		expect(created).toHaveBeenCalledWith(expect.objectContaining({ invoiceNumber: 42, status: 'DRAFT' }));
	});

	it.each([
		['a string, as the database answers a bigint', '41', 42],
		['nothing yet', 0, 1],
		['no answer', undefined, 1]
	])('numbers after %s', async (_name, max, expected) => {
		highest(max);
		await service.duplicate('source-id');
		expect(created).toHaveBeenCalledWith(expect.objectContaining({ invoiceNumber: expected }));
	});

	it('refuses when the sequence cannot take another number, writing nothing', async () => {
		highest(Number.MAX_SAFE_INTEGER);
		await expect(service.duplicate('source-id')).rejects.toThrow('INVOICE_NUMBER_SEQUENCE_EXHAUSTED');
		expect(created).not.toHaveBeenCalled();
	});

	it('hands the create no line that bills time or an expense', async () => {
		highest(41);
		await service.duplicate('source-id');
		const [input] = created.mock.calls[0];
		expect(input.invoiceItems.length).toBeGreaterThan(0);
		expect(input.invoiceItems.every((line) => !('timeLogIds' in line) && !('expenseId' in line))).toBe(true);
	});

	it('takes the next number when another write took the one it read', async () => {
		jest.spyOn(service, 'getHighestInvoiceNumber')
			.mockResolvedValueOnce({ max: 41 } as never) // the first attempt reads 41 and takes 42
			.mockResolvedValue({ max: 42 } as never); // 42 was taken meanwhile: the next attempt takes 43
		created
			.mockRejectedValueOnce(new BadRequestException('duplicate key'))
			.mockResolvedValue({ id: 'copy' } as never);

		await expect(service.duplicate('source-id')).resolves.toEqual({ id: 'copy' });
		expect(created.mock.calls.map(([input]) => input.invoiceNumber)).toEqual([42, 43]);
	});

	it('answers any other failure as it is, trying once', async () => {
		highest(41);
		created.mockRejectedValue(new Error('boom'));

		await expect(service.duplicate('source-id')).rejects.toThrow('boom');
		expect(created).toHaveBeenCalledTimes(1);
	});

	it('gives up after three numbers taken by other writes', async () => {
		let max = 41;
		jest.spyOn(service, 'getHighestInvoiceNumber').mockImplementation(async () => ({ max: max++ }) as never);
		created.mockRejectedValue(new BadRequestException('duplicate key'));

		await expect(service.duplicate('source-id')).rejects.toThrow('duplicate key');
		expect(created).toHaveBeenCalledTimes(3);
	});

	it('writes nothing when the source cannot be read', async () => {
		highest(41);
		jest.spyOn(service, 'findOneByIdString').mockRejectedValue(new Error('not found'));
		await expect(service.duplicate('source-id')).rejects.toThrow('not found');
		expect(created).not.toHaveBeenCalled();
	});
});
