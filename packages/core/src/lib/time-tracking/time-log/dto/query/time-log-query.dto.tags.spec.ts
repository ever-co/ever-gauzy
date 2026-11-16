// Must stay first: see time-log.service.spec.ts.
import '../../../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TimeLogBudgetQueryDTO, TimeLogLimitQueryDTO, TimeLogListQueryDTO, TimeLogQueryDTO } from '.';

const MEETING = '00000000-0000-4000-8000-0000000000a1';
const SUPPORT = '00000000-0000-4000-8000-0000000000a2';

/**
 * The time log reads validate their query with `whitelist: true`, which drops any parameter the DTO does not declare.
 * `tagIds` and `untagged` are declared on the list, the daily report and its chart, and the weekly report, and left out
 * of the budget routes, which count every log through their own queries.
 */
describe('tag filters on the time log queries', () => {
	/** The query as the route's pipe leaves it: transformed and validated, with the errors on the tag filters. */
	const parsed = async (metatype: new () => object, query: Record<string, unknown>) => {
		const dto = plainToInstance(metatype, query) as Record<string, unknown>;
		const errors = await validate(dto, { whitelist: true });
		const tagErrors = errors.filter((error) => ['tagIds', 'untagged'].includes(error.property));
		return { dto, tagErrors };
	};

	it.each([TimeLogQueryDTO, TimeLogListQueryDTO, TimeLogLimitQueryDTO])('keeps the tags asked for on %p', async (metatype) => {
		const { dto, tagErrors } = await parsed(metatype, { tagIds: [MEETING, SUPPORT], untagged: 'true' });

		expect(tagErrors).toEqual([]);
		expect(dto).toMatchObject({ tagIds: [MEETING, SUPPORT], untagged: true });
	});

	it('reads one tag sent alone in the query string as a list of one', async () => {
		const { dto, tagErrors } = await parsed(TimeLogListQueryDTO, { tagIds: MEETING });

		expect(tagErrors).toEqual([]);
		expect(dto.tagIds).toEqual([MEETING]);
	});

	it('refuses a tag id that is not one', async () => {
		const { tagErrors } = await parsed(TimeLogQueryDTO, { tagIds: ['meeting'] });

		expect(tagErrors.map((error) => error.property)).toEqual(['tagIds']);
	});

	it('leaves both unset when the query sends neither', async () => {
		const { dto } = await parsed(TimeLogListQueryDTO, {});

		expect(dto.tagIds).toBeUndefined();
		expect(dto.untagged).toBeUndefined();
	});

	it('drops both on the budget routes', async () => {
		const { dto } = await parsed(TimeLogBudgetQueryDTO, { tagIds: [MEETING], untagged: 'true' });

		expect(dto).not.toHaveProperty('tagIds');
		expect(dto).not.toHaveProperty('untagged');
	});
});
