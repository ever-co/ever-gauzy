import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateInvoiceDTO } from './update-invoice.dto';
import { UpdateInvoiceWithItemsDTO } from './update-invoice-with-items.dto';

/**
 * The bodies of `PUT /invoices/:id` and `PUT /invoices/:id/with-items` keep `expectedUpdatedAt` through the whitelisting
 * validation both routes run, and refuse one that is no date and time. Nothing names an organization of its own
 * (`sentTo`), which keeps the organization membership check, and the database it reads, out of this spec.
 */
const READ_AT = '2026-11-16T10:20:30.456Z';

const SENT_TO = 'e0000000-0000-4000-8000-000000000001';

const LINE = {
	description: 'Design',
	price: 50,
	quantity: 2,
	totalValue: 100,
	invoiceId: 'd0000000-0000-4000-8000-000000000001',
	timeLogIds: ['c0000000-0000-4000-8000-000000000001'],
	sentTo: SENT_TO
};

const FIELDS = {
	invoiceNumber: 7,
	invoiceDate: '2026-11-01T00:00:00.000Z',
	dueDate: '2026-11-30T00:00:00.000Z',
	status: 'DRAFT',
	currency: 'EUR',
	terms: 'Billable time from 2026-10-01 to 2026-10-31',
	sentTo: SENT_TO
};

async function validated<T>(metatype: new () => T, body: object): Promise<T> {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });
	const metadata: ArgumentMetadata = { type: 'body', metatype };
	return await pipe.transform(body, metadata);
}

describe('UpdateInvoiceDTO.expectedUpdatedAt', () => {
	it('keeps the precondition through the whitelisting validation', async () => {
		const input = await validated(UpdateInvoiceDTO, { ...FIELDS, expectedUpdatedAt: READ_AT });

		expect(input.expectedUpdatedAt).toBe(READ_AT);
	});

	it('leaves it out when none is stated: the update is written as it always was', async () => {
		const input = await validated(UpdateInvoiceDTO, FIELDS);

		expect(input.expectedUpdatedAt).toBeUndefined();
	});

	it.each(['yesterday', '2026-13-01T00:00:00Z', 1763288430456])('refuses %p', async (expectedUpdatedAt) => {
		await expect(validated(UpdateInvoiceDTO, { ...FIELDS, expectedUpdatedAt })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});

describe('UpdateInvoiceWithItemsDTO', () => {
	it('keeps the fields, the lines with the time they bill, and the precondition', async () => {
		const input = await validated(UpdateInvoiceWithItemsDTO, {
			...FIELDS,
			invoiceItems: [LINE],
			expectedUpdatedAt: READ_AT,
			unknownMember: 'dropped'
		});

		expect(input).toMatchObject({ ...FIELDS, expectedUpdatedAt: READ_AT });
		expect(input.invoiceItems).toEqual([expect.objectContaining(LINE)]);
		expect(input).not.toHaveProperty('unknownMember');
	});

	it('accepts an invoice saved with no line at all', async () => {
		const input = await validated(UpdateInvoiceWithItemsDTO, { ...FIELDS, invoiceItems: [] });

		expect(input.invoiceItems).toEqual([]);
	});

	it.each([
		['no lines', {}],
		['lines that are no list', { invoiceItems: LINE }],
		[
			'a line without its amounts',
			{ invoiceItems: [{ description: 'Design', invoiceId: LINE.invoiceId, sentTo: SENT_TO }] }
		],
		['a precondition that is no date and time', { invoiceItems: [LINE], expectedUpdatedAt: 'yesterday' }]
	])('refuses %s', async (_label, body) => {
		await expect(validated(UpdateInvoiceWithItemsDTO, { ...FIELDS, ...body })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});
