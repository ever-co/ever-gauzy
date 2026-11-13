import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '../core/entities/internal';
import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskMetadataService } from './task-metadata.service';

type Row = Record<string, unknown>;

/**
 * A Knex stand-in over in-memory tables: `where` (an object, or a column and a value), `whereNull`, `select`,
 * `first`, and `modify` as `fetchAllByKnex` calls it.
 */
function knexOver(tables: Record<string, Row[]>) {
	const tableReads: string[] = [];
	const knex = jest.fn((table: string) => {
		tableReads.push(table);
		let rows = tables[table] ?? [];
		const builder = {
			select: () => builder,
			where: (criteria: Row | string, value?: unknown) => {
				const pairs = typeof criteria === 'string' ? [[criteria, value]] : Object.entries(criteria);
				rows = rows.filter((row) => pairs.every(([column, expected]) => row[column as string] === expected));
				return builder;
			},
			whereNull: (column: string) => {
				rows = rows.filter((row) => row[column] === null || row[column] === undefined);
				return builder;
			},
			first: () => Promise.resolve(rows[0]),
			modify: (callback: (qb: unknown) => void) => {
				callback(builder);
				return Object.assign(Promise.resolve(rows), { first: () => Promise.resolve(rows[0]) });
			}
		};
		return builder;
	});
	return { knex, tableReads };
}

/**
 * ever-co/ever-teams#5024: a client names an icon the user uploaded `image-asset:<image asset id>`. The task metadata
 * services (statuses, priorities, sizes, versions, issue types, related issue types) store it completed from the
 * image asset of the caller's tenant, and list it with a URL from the provider that holds the file.
 */
describe('TaskMetadataService uploaded icons', () => {
	const fixture = createTenantFixture();
	const otherTenantId = randomUUID();
	const assetId = randomUUID();
	const key = `uploads/task_property_icons/${fixture.tenantId}/image-assets-1731340000-${randomUUID()}.png`;
	const stored = `image-asset:${assetId}:LOCAL:${key}`;
	const statusId = randomUUID();

	let restore: () => void;
	let tables: Record<string, Row[]>;

	const serviceOver = () => {
		const { knex, tableReads } = knexOver(tables);
		const service = new TaskMetadataService<TaskStatus>(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'task_status' } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			knex as any
		);
		return { service, tableReads };
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		tables = {
			image_asset: [
				{ id: assetId, url: key, storageProvider: 'LOCAL', tenantId: fixture.tenantId, deletedAt: null }
			],
			task_status: [
				{
					id: statusId,
					icon: 'hugeicons:done',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId,
					projectId: null,
					organizationTeamId: null,
					deletedAt: null
				}
			]
		};
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => entity as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'update').mockImplementation(
			async (_id, entity) => entity as never
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('stores an uploaded icon completed from its image asset on create and on update', async () => {
		const { service } = serviceOver();

		await expect(service.create({ name: 'QA', icon: `image-asset:${assetId}` })).resolves.toMatchObject({
			name: 'QA',
			icon: stored
		});
		await expect(service.update(statusId, { icon: `image-asset:${assetId}` })).resolves.toEqual({ icon: stored });
	});

	it('writes any other icon as it is, without reading an image asset', async () => {
		const { service, tableReads } = serviceOver();

		await expect(service.create({ name: 'QA', icon: 'hugeicons:rocket' })).resolves.toMatchObject({
			icon: 'hugeicons:rocket'
		});
		await expect(service.update(statusId, { name: 'Done' })).resolves.toEqual({ name: 'Done' });
		await expect(service.update(statusId, { icon: null })).resolves.toEqual({ icon: null });
		expect(tableReads).toEqual([]);
	});

	it('refuses an image asset of another tenant', async () => {
		tables.image_asset[0].tenantId = otherTenantId;
		const { service } = serviceOver();

		await expect(service.create({ name: 'QA', icon: `image-asset:${assetId}` })).rejects.toThrow(
			BadRequestException
		);
		expect(TenantAwareCrudService.prototype.create).not.toHaveBeenCalled();
	});

	it('keeps the icon a row stores when its image asset was deleted, so the row can still be renamed', async () => {
		tables.task_status[0].icon = stored;
		tables.image_asset[0].deletedAt = new Date();
		const { service } = serviceOver();

		await expect(service.update(statusId, { name: 'Done', icon: stored })).resolves.toEqual({
			name: 'Done',
			icon: stored
		});
		await expect(service.update(randomUUID(), { icon: stored })).rejects.toThrow(BadRequestException);
	});

	it('lists an uploaded icon of the tenant with the URL of the provider that holds it', async () => {
		const foreignKey = `uploads/task_property_icons/${otherTenantId}/a.png`;
		tables.task_status.push(
			{ ...tables.task_status[0], id: 'uploaded', icon: stored },
			{ ...tables.task_status[0], id: 'foreign', icon: `image-asset:${assetId}:LOCAL:${foreignKey}` },
			{ ...tables.task_status[0], id: 'pending', icon: `image-asset:${assetId}` }
		);
		const { service } = serviceOver();

		const { items } = await service.fetchAllByKnex({
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId
		});
		const urls = new Map(items.map((item: TaskStatus) => [item.id, item.fullIconUrl]));

		expect(new URL(urls.get('uploaded') as string).pathname).toBe(`/public/${key}`);
		expect(urls.get('foreign')).toBeNull();
		expect(urls.get('pending')).toBeNull();
	});
});
