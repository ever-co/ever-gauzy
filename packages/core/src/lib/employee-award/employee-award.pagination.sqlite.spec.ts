// The dialect helpers read DB_TYPE once, when @gauzy/config loads: the entities map for the embedded database.
jest.mock('@gauzy/config', () => {
	process.env.DB_TYPE = 'better-sqlite3';
	return jest.requireActual('@gauzy/config');
});

import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { Employee, EmployeeAward, Organization, Tenant, User } from '../core/entities/internal';
import { insertRow } from '../database/testing/insert-row';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardService } from './employee-award.service';
import { TypeOrmEmployeeAwardRepository } from './repository/type-orm-employee-award.repository';

/**
 * The MCP server's award tools read `/employee-award/pagination` (#12100), the route the award controller inherits:
 * it reads `skip` as a page number and joins the relations asked. On a real database, the second page of five among
 * twelve awards holds awards 6 to 10, each with its employee.
 */

/** Booting the whole entity graph on SQLite takes a while. */
const TIMEOUT = 600_000;

const TENANT = '16000000-0000-4000-8000-000000000001';
const ORGANIZATION = '16000000-0000-4000-8000-000000000002';
const USER = '16000000-0000-4000-8000-000000000003';
const EMPLOYEE = '16000000-0000-4000-8000-000000000004';
const AWARDS = 12;

describe('EmployeeAwardController pagination on SQLite', () => {
	/** The request context a real request runs in: the base service keeps its bypasses there. */
	const cls = new ClsService(new AsyncLocalStorage());
	const originalClsService = RequestContext['clsService'];
	let dataSource: DataSource;
	let controller: EmployeeAwardController;

	beforeAll(async () => {
		RequestContext.setClsService(cls);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const { coreEntities } = require('../core/entities');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			synchronize: true,
			entities: coreEntities,
			logging: false
		});
		await dataSource.initialize();

		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		await insertRow(dataSource, Tenant, { id: TENANT, name: 'Northwind Studio' });
		await insertRow(dataSource, Organization, {
			id: ORGANIZATION,
			tenantId: TENANT,
			name: 'Northwind',
			currency: 'EUR'
		});
		await insertRow(dataSource, User, { id: USER, tenantId: TENANT, email: 'lina@northwind.example' });
		await insertRow(dataSource, Employee, {
			id: EMPLOYEE,
			...scope,
			userId: USER,
			isActive: true,
			isArchived: false
		});
		for (let rank = 1; rank <= AWARDS; rank++) {
			const number = String(rank).padStart(2, '0');
			await insertRow(dataSource, EmployeeAward, {
				id: `16000000-0000-4000-9000-0000000000${number}`,
				...scope,
				employeeId: EMPLOYEE,
				name: `Award ${number}`,
				year: '2026'
			});
		}

		const repository = new TypeOrmEmployeeAwardRepository(dataSource.getRepository(EmployeeAward));
		controller = new EmployeeAwardController(new EmployeeAwardService(repository, {} as never));
	}, TIMEOUT);

	afterAll(async () => {
		RequestContext.setClsService(originalClsService);
		jest.restoreAllMocks();
		await dataSource?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: USER,
			tenantId: TENANT,
			employeeId: EMPLOYEE
		} as never);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
	});

	it(
		'answers the second page of five, awards 6 to 10, each with its employee',
		() =>
			cls.run(async () => {
				const page = await controller.pagination({
					where: { organizationId: ORGANIZATION, tenantId: TENANT },
					take: 5,
					skip: 2,
					relations: ['employee'],
					order: { name: 'ASC', id: 'ASC' }
				} as never);

				expect(page.total).toBe(AWARDS);
				expect(page.items.map((award) => award.name)).toEqual([
					'Award 06',
					'Award 07',
					'Award 08',
					'Award 09',
					'Award 10'
				]);
				expect(page.items.map((award) => award.employee?.id)).toEqual(Array(5).fill(EMPLOYEE));
			}),
		TIMEOUT
	);
});
