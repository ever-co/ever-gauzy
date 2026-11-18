import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { OmitType } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SavedReportPeriodRuleEnum } from '@gauzy/contracts';
import { CreateSavedReportDTO, UpdateSavedReportDTO } from './saved-report.dto';

const DESIGN = 'd0000000-0000-4000-8000-0000000000d1';
const REVIEW = 'd0000000-0000-4000-8000-0000000000d2';

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

/**
 * The body of a save without its organization, whose membership check reads the database: what the save keeps of the
 * report page's view, validated as the route validates it.
 */
class SaveBodyDTO extends OmitType(CreateSavedReportDTO, ['tenantId', 'organizationId'] as const) {}

/** A body as the saved reports routes take it: their validation pipe, `{ whitelist: true, transform: true }`. */
async function bodyOf<T>(metatype: new () => T, body: Record<string, unknown>): Promise<T> {
	const pipe = new ValidationPipe({ whitelist: true, transform: true });
	return (await pipe.transform(body, { type: 'body', metatype })) as T;
}

/** "Design work, by label, last month": the view of the report page narrowed by two labels and the time without one. */
function labelledBody(changes: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: 'Design work, by label',
		periodRule: SavedReportPeriodRuleEnum.LAST_MONTH,
		filters: { projectIds: [], tagIds: [DESIGN, REVIEW], untagged: true },
		grouping: 'label',
		...changes
	};
}

describe('saved report labels (the labels filter and the Label grouping of the report page)', () => {
	it('keeps the labels filter of a save, by tag id, with the time without a label', async () => {
		const body = await bodyOf(SaveBodyDTO, labelledBody());

		expect(body.filters).toEqual({ projectIds: [], tagIds: [DESIGN, REVIEW], untagged: true });
		expect(body.grouping).toBe('label');
	});

	it('keeps the labels filter and the Label grouping of an update', async () => {
		const body = await bodyOf(UpdateSavedReportDTO, {
			filters: { tagIds: [DESIGN], untagged: false },
			grouping: 'label'
		});

		expect(body.filters).toEqual({ tagIds: [DESIGN], untagged: false });
		expect(body.grouping).toBe('label');
	});

	it('takes a body without labels as before', async () => {
		const body = await bodyOf(
			SaveBodyDTO,
			labelledBody({ filters: { clientIds: ['none'], billableOnly: true }, grouping: 'project' })
		);

		expect(body.filters).toEqual({ clientIds: ['none'], billableOnly: true });
		expect(body.grouping).toBe('project');
	});

	it('still drops a filter it does not know, and refuses a grouping it does not know', async () => {
		const body = await bodyOf(
			SaveBodyDTO,
			labelledBody({ filters: { tagIds: [DESIGN], labels: ['design'], tagNames: ['Design'] } })
		);

		expect(body.filters).toEqual({ tagIds: [DESIGN] });
		await expect(bodyOf(SaveBodyDTO, labelledBody({ grouping: 'colour' }))).rejects.toThrow(BadRequestException);
	});

	it('refuses a label that is not a tag id, labels sent as one value, and a "no label" choice that is not a yes or no', async () => {
		expect(await failedPropertiesOf({ filters: { tagIds: ['design'] } })).toContain('filters');
		expect(await failedPropertiesOf({ filters: { tagIds: DESIGN } })).toContain('filters');
		expect(await failedPropertiesOf({ filters: { untagged: 'yes' } })).toContain('filters');
		expect(await failedPropertiesOf({ filters: { tagIds: [DESIGN], untagged: true } })).toEqual([]);
	});

	it('refuses more labels than any other filter takes', async () => {
		const tooMany = Array.from(
			{ length: 201 },
			(_, index) => `d0000000-0000-4000-8000-${String(index).padStart(12, '0')}`
		);

		expect(await failedPropertiesOf({ filters: { tagIds: tooMany } })).toContain('filters');
	});
});
