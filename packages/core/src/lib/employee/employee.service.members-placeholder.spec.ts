import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { EmployeeService } from './employee.service';

/**
 * The member list (`GET /employee/members`) reads an explicit set of fields under both ORMs. A member without an
 * account (ever-co/ever-gauzy#11913) is marked in every answer that lists members, so the set carries the flag and the
 * email it was created with.
 */
afterEach(() => {
	jest.restoreAllMocks();
});

function serviceWith(ormType: 'typeorm' | 'mikro-orm', repositories: Record<string, unknown>): EmployeeService {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	const service: EmployeeService = Object.create(EmployeeService.prototype);
	// `ormType` is a getter of the base service: the instance gets its own value.
	Object.defineProperty(service, 'ormType', { value: ormType });
	Object.assign(service, repositories);
	return service;
}

describe('EmployeeService.findMembers', () => {
	it('selects whether each member has an account, and a placeholder email, under TypeORM', async () => {
		const options: Record<string, any> = {};
		const query = {
			alias: 'employee',
			leftJoin: jest.fn(),
			andWhere: jest.fn(),
			setFindOptions: jest.fn((value: Record<string, unknown>) => Object.assign(options, value)),
			getManyAndCount: jest.fn(async () => [[], 0])
		};
		const service = serviceWith('typeorm', { typeOrmEmployeeRepository: { createQueryBuilder: () => query } });

		await service.findMembers({ organizationId: 'organization-1' } as never);

		expect(options.select).toMatchObject({ isPlaceholder: true, placeholderEmail: true });
	});

	it('asks for the same fields under MikroORM', async () => {
		const findAndCount = jest.fn(async () => [[], 0]);
		const service = serviceWith('mikro-orm', { mikroOrmRepository: { findAndCount } });

		await service.findMembers({ organizationId: 'organization-1' } as never);

		const [, findOptions] = findAndCount.mock.calls[0] as unknown as [unknown, { fields: string[] }];
		expect(findOptions.fields).toEqual(expect.arrayContaining(['isPlaceholder', 'placeholderEmail']));
	});
});
