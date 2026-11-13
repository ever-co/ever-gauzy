import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { InvoiceItemBulkInputDTO } from './invoice-item-bulk-input.dto';

/**
 * A line states the time logs it bills in `timeLogIds`. The field is declared, so a whitelisting validation keeps it
 * (the invoice edit runs one), and it is refused when it is not a list of ids. The line names no organization of its
 * own (`sentTo`), which keeps the organization membership check, and the database it reads, out of this spec.
 */
const TIME_LOGS = ['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'];

const LINE = {
	description: 'Design',
	price: 50,
	quantity: 2,
	totalValue: 100,
	invoiceId: 'd0000000-0000-4000-8000-000000000001',
	sentTo: 'e0000000-0000-4000-8000-000000000001'
};

const BULK_BODY: ArgumentMetadata = { type: 'body', metatype: InvoiceItemBulkInputDTO };

async function validated(line: object): Promise<InvoiceItemBulkInputDTO> {
	const pipe = new ValidationPipe({ transform: true, whitelist: true });
	return await pipe.transform({ list: [line] }, BULK_BODY);
}

describe('CreateInvoiceItemDTO.timeLogIds', () => {
	it('keeps the time logs a line bills through a whitelisting validation', async () => {
		const input = await validated({ ...LINE, timeLogIds: TIME_LOGS });

		expect(input.list[0].timeLogIds).toEqual(TIME_LOGS);
	});

	it.each([
		['an id that is not a uuid', ['not-a-uuid']],
		['a single id instead of a list', TIME_LOGS[0]]
	])('refuses %s', async (_label, timeLogIds) => {
		await expect(validated({ ...LINE, timeLogIds })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('still accepts a line that names no time log', async () => {
		const input = await validated(LINE);

		expect(input.list[0].timeLogIds).toBeUndefined();
	});
});
