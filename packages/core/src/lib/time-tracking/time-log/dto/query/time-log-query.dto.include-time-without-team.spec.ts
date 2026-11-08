// Must stay first: see time-log.service.spec.ts.
import '../../../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TimeLogBudgetQueryDTO, TimeLogLimitQueryDTO, TimeLogListQueryDTO, TimeLogQueryDTO } from '.';

/**
 * The report routes validate their query with `whitelist: true`, which drops any parameter the DTO does not declare.
 * `includeTimeWithoutTeam` is declared on the reports that filter by team, read as a boolean from the query string,
 * and left out of the budget routes, which count every log through their own queries.
 */
describe('includeTimeWithoutTeam on the time log report queries', () => {
	/** The query as the route's pipe leaves it: transformed, then stripped of what the DTO does not declare. */
	const parsed = async (metatype: new () => object, query: Record<string, unknown>) => {
		const dto = plainToInstance(metatype, query) as Record<string, unknown>;
		const errors = await validate(dto, { whitelist: true });
		const flagErrors = errors.filter((error) => error.property === 'includeTimeWithoutTeam');
		expect(flagErrors).toEqual([]);
		return dto;
	};

	it.each([TimeLogQueryDTO, TimeLogListQueryDTO, TimeLogLimitQueryDTO])(
		'keeps the parameter as a boolean on %p',
		async (metatype) => {
			await expect(parsed(metatype, { includeTimeWithoutTeam: 'true' })).resolves.toMatchObject({
				includeTimeWithoutTeam: true
			});
			await expect(parsed(metatype, { includeTimeWithoutTeam: 'false' })).resolves.toMatchObject({
				includeTimeWithoutTeam: false
			});
		}
	);

	it('leaves the parameter unset when the query does not send it', async () => {
		const query = await parsed(TimeLogQueryDTO, {});

		expect(query.includeTimeWithoutTeam).toBeUndefined();
	});

	it('drops the parameter on the budget routes', async () => {
		const query = await parsed(TimeLogBudgetQueryDTO, { includeTimeWithoutTeam: 'true' });

		expect(query).not.toHaveProperty('includeTimeWithoutTeam');
	});
});
