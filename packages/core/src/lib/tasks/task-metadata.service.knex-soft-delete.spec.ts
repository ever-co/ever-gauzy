import '../core/entities/internal';

import { TaskStatus } from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskMetadataService } from './task-metadata.service';

/**
 * On TypeORM + PostgreSQL the task statuses, priorities, sizes, versions and issue types are listed with raw
 * Knex, which has no soft-delete filter. Every Knex query must exclude soft-deleted rows itself, or a deleted
 * status keeps being listed (and keeps the fallback to the system defaults from kicking in).
 */
describe('TaskMetadataService Knex queries exclude soft-deleted rows', () => {
	const fixture = createTenantFixture();

	let restore: () => void;
	let builder: { modify: jest.Mock; first: jest.Mock; where: jest.Mock; whereNull: jest.Mock };
	let service: TaskMetadataService<TaskStatus>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		builder = {
			modify: jest.fn(),
			first: jest.fn().mockResolvedValue(undefined),
			where: jest.fn(),
			whereNull: jest.fn()
		};
		// `modify` hands the builder to the callback; awaiting its result (or `.first()`) runs the query
		builder.modify.mockImplementation((callback: (qb: unknown) => void) => {
			callback(builder);
			return Object.assign(Promise.resolve([]), { first: builder.first });
		});
		const knex = jest.fn(() => builder);
		service = new TaskMetadataService<TaskStatus>(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'task_status' } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			knex as any
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const request = () => ({ tenantId: fixture.tenantId, organizationId: fixture.organizationId });

	it('scoped lookups (first match and list) skip soft-deleted rows', async () => {
		await service.getOneOrFailByKnex(request());
		await service.getManyAndCountByKnex(request());

		const deletedAtFilters = builder.whereNull.mock.calls.filter(([column]) => column === 'deletedAt');
		expect(deletedAtFilters).toHaveLength(2);
		expect(builder.where).toHaveBeenCalledWith('tenantId', fixture.tenantId);
		expect(builder.where).toHaveBeenCalledWith('organizationId', fixture.organizationId);
	});

	it('the system defaults skip soft-deleted rows', async () => {
		await service.getDefaultEntitiesByKnex();

		expect(builder.where).toHaveBeenCalledWith('isSystem', true);
		expect(builder.whereNull).toHaveBeenCalledWith('deletedAt');
	});
});
