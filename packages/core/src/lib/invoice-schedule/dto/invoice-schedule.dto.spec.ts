import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateInvoiceScheduleDTO } from './invoice-schedule.dto';

/** The properties a change is refused on, with the organization check left out (it reads the caller's own). */
async function refusedFieldsOf(body: Record<string, unknown>): Promise<string[]> {
	const dto = plainToInstance(UpdateInvoiceScheduleDTO, body);
	const errors = await validate(dto, { skipMissingProperties: false });
	return errors
		.map(({ property }) => property)
		.filter((property) => property !== 'organizationId' && property !== 'organization');
}

describe('UpdateInvoiceScheduleDTO', () => {
	it('lets a change leave out every field', async () => {
		expect(await refusedFieldsOf({})).toEqual([]);
	});

	it('refuses a field sent as null: a change can set it, never clear it', async () => {
		expect(
			await refusedFieldsOf({ frequency: null, startDay: null, grouping: null, sendInvoice: null, paused: null })
		).toEqual(['frequency', 'startDay', 'grouping', 'sendInvoice', 'paused']);
	});

	it('takes a whole change', async () => {
		expect(
			await refusedFieldsOf({
				frequency: 'WEEKLY',
				startDay: '2026-11-02',
				grouping: 'TASK',
				sendInvoice: true,
				paused: false
			})
		).toEqual([]);
	});
});
