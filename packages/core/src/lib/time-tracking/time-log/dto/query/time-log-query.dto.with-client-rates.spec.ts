// Must stay first: see time-log.service.spec.ts.
import '../../../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TimeLogBudgetQueryDTO, TimeLogDailyReportQueryDTO, TimeLogListQueryDTO, TimeLogQueryDTO } from '.';

/**
 * The time log reads validate their query with `whitelist: true`, which drops any parameter the DTO does not declare.
 * `withClientRates` is offered on the entry list and the daily report only: the other reads drop it, and answer as
 * they did.
 */
describe('withClientRates on the time log queries', () => {
	/** The query as the route's pipe leaves it: transformed, then stripped of what the DTO does not declare. */
	const parsed = async (metatype: new () => object, query: Record<string, unknown>) => {
		const dto = plainToInstance(metatype, query) as Record<string, unknown>;
		const errors = await validate(dto, { whitelist: true });
		const flagErrors = errors.filter((error) => error.property === 'withClientRates');
		expect(flagErrors).toEqual([]);
		return dto;
	};

	it.each([TimeLogListQueryDTO, TimeLogDailyReportQueryDTO])('keeps the opt-in as a boolean on %p', async (metatype) => {
		await expect(parsed(metatype, { withClientRates: 'true' })).resolves.toMatchObject({ withClientRates: true });
		await expect(parsed(metatype, { withClientRates: 'false' })).resolves.toMatchObject({ withClientRates: false });
	});

	it('leaves the opt-in unset when the query does not send it', async () => {
		const query = await parsed(TimeLogListQueryDTO, {});

		expect(query.withClientRates).toBeUndefined();
	});

	it.each([TimeLogQueryDTO, TimeLogBudgetQueryDTO])('drops the opt-in on the other reads (%p)', async (metatype) => {
		const query = await parsed(metatype, { withClientRates: 'true' });

		expect(query).not.toHaveProperty('withClientRates');
	});
});
