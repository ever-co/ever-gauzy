import '../core/entities/internal';

import { TaskStatus } from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskMetadataService } from './task-metadata.service';

/**
 * On TypeORM + PostgreSQL the task statuses, priorities, sizes, versions and related issue types are listed with
 * raw Knex: no entity load hook runs, so `fetchAllByKnex` builds `fullIconUrl` itself. It must follow the rules of
 * the load hooks (`localFileUrl`). An icon of the Ever Teams library (`hugeicons:<key>`, ever-co/ever-teams#5024) is
 * no file, so it gets no URL instead of `<API>/public/hugeicons:done`.
 */
describe('TaskMetadataService.fetchAllByKnex icon URLs', () => {
	const fixture = createTenantFixture();

	let restore: () => void;
	let service: TaskMetadataService<TaskStatus>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		const rows = [
			{ id: 'open', icon: 'ever-icons/task-statuses/open.svg' },
			{ id: 'done', icon: 'hugeicons:done' },
			{ id: 'custom', icon: 'https://cdn.example.com/icons/rocket.png' },
			{ id: 'plain', icon: null }
		];
		const builder = { modify: jest.fn(), where: jest.fn(), whereNull: jest.fn() };
		// `modify` hands the builder to the callback; awaiting its result lists the rows, `.first()` gives the first
		builder.modify.mockImplementation((callback: (qb: unknown) => void) => {
			callback(builder);
			return Object.assign(Promise.resolve(rows), { first: () => Promise.resolve(rows[0]) });
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

	it('serves an icon file, keeps a URL, and gives no URL for a library icon', async () => {
		const { items, total } = await service.fetchAllByKnex({
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId
		});
		const urls = new Map(items.map((item: TaskStatus) => [item.id, item.fullIconUrl]));

		expect(total).toBe(4);
		expect(new URL(urls.get('open') as string).pathname).toBe('/public/ever-icons/task-statuses/open.svg');
		expect(urls.get('done')).toBeNull();
		expect(urls.get('custom')).toBe('https://cdn.example.com/icons/rocket.png');
		expect(urls.get('plain')).toBeUndefined();
	});
});
