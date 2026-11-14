import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSavedReportDTO } from './saved-report.dto';

/** The properties a body fails validation on. */
async function failedPropertiesOf(body: Record<string, unknown>): Promise<string[]> {
	const errors = await validate(plainToInstance(UpdateSavedReportDTO, body), { whitelist: true });
	return errors.map((error) => error.property);
}

describe('saved report filters', () => {
	it('refuses filters sent as a list, which the report would otherwise read as no filter at all', async () => {
		expect(await failedPropertiesOf({ filters: [{ billableOnly: true }] })).toContain('filters');
	});

	it('accepts filters sent as one object, and refuses an id that is not one', async () => {
		expect(await failedPropertiesOf({ filters: { clientIds: ['none'], billableOnly: true } })).toEqual([]);
		expect(await failedPropertiesOf({ filters: { projectIds: ['not-an-id'] } })).toContain('filters');
	});
});
