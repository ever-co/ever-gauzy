// Must stay first: see time-log.service.spec.ts.
import '../../../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TimeLogBudgetQueryDTO, TimeLogLimitQueryDTO, TimeLogListQueryDTO, TimeLogQueryDTO } from '.';

/**
 * The time log reads validate their query with `whitelist: true`, which drops any parameter the DTO does not declare.
 * `notInvoiced` is declared beside `billableOnly`, read as a boolean from the query string, and left out of the budget
 * routes, which count every log through their own queries.
 */
describe('notInvoiced on the time log queries', () => {
	/** The query as the route's pipe leaves it: transformed, then stripped of what the DTO does not declare. */
	const parsed = async (metatype: new () => object, query: Record<string, unknown>) => {
		const dto = plainToInstance(metatype, query) as Record<string, unknown>;
		const errors = await validate(dto, { whitelist: true });
		const flagErrors = errors.filter((error) => error.property === 'notInvoiced');
		expect(flagErrors).toEqual([]);
		return dto;
	};

	it.each([TimeLogQueryDTO, TimeLogListQueryDTO, TimeLogLimitQueryDTO])(
		'keeps the parameter as a boolean on %p',
		async (metatype) => {
			await expect(parsed(metatype, { notInvoiced: 'true' })).resolves.toMatchObject({ notInvoiced: true });
			await expect(parsed(metatype, { notInvoiced: 'false' })).resolves.toMatchObject({ notInvoiced: false });
		}
	);

	it('leaves the parameter unset when the query does not send it', async () => {
		const query = await parsed(TimeLogListQueryDTO, {});

		expect(query.notInvoiced).toBeUndefined();
	});

	it('drops the parameter on the budget routes', async () => {
		const query = await parsed(TimeLogBudgetQueryDTO, { notInvoiced: 'true' });

		expect(query).not.toHaveProperty('notInvoiced');
	});
});
