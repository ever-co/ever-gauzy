import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TimeOffRequestService } from './time-off-request.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `take` is optional on the pagination query. The TypeORM list multiplied `skip` by `take` without the
 * default page size the MikroORM branch applies, so `?skip=2` alone gave a NaN offset and the request failed.
 */
describe('TimeOffRequestService.pagination offset (TypeORM)', () => {
	const { tenantA } = createCrossTenantFixture();

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	/** The find options handed to the query builder for the given pagination options. */
	const findOptionsFor = async (options: Record<string, unknown>) => {
		const query = {
			alias: 'time_off_request',
			setFindOptions: jest.fn(),
			leftJoin: jest.fn(),
			where: jest.fn(),
			getManyAndCount: jest.fn().mockResolvedValue([[], 0])
		};
		const service = new TimeOffRequestService(
			{
				metadata: { tableName: 'time_off_request' },
				createQueryBuilder: jest.fn().mockReturnValue(query)
			} as any,
			{} as any,
			{} as any
		);

		await service.pagination({ where: { organizationId: tenantA.organizationId }, ...options });

		return query.setFindOptions.mock.calls[0][0];
	};

	it('uses the default page size for the offset when skip is sent without take', async () => {
		const { skip, take } = await findOptionsFor({ skip: 2 });

		expect(skip).toBe(10);
		expect(take).toBe(10);
	});

	it('keeps the offset computed from take when both are sent', async () => {
		const { skip, take } = await findOptionsFor({ skip: 3, take: 25 });

		expect(skip).toBe(50);
		expect(take).toBe(25);
	});

	it('starts at the first row when skip is not sent', async () => {
		const { skip } = await findOptionsFor({ take: 25 });

		expect(skip).toBe(0);
	});
});
