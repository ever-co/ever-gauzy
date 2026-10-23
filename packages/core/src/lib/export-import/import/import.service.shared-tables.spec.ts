import 'reflect-metadata';

jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));
jest.mock('../../core/context', () => ({
	RequestContext: {
		currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a',
		currentUserId: () => 'u0000000-0000-4000-8000-00000000000u'
	}
}));
jest.mock('../../core/utils', () => ({ convertToDatetime: (value: unknown) => value }));
jest.mock('../../core/entities/internal', () => ({ Organization: class Organization {} }));
jest.mock('../../core/file-storage', () => ({ FileStorage: class FileStorage {} }));
jest.mock('./commands', () => ({
	ImportEntityFieldMapOrCreateCommand: class ImportEntityFieldMapOrCreateCommand {
		constructor(...args: unknown[]) {
			Object.assign(this, { args });
		}
	}
}));
jest.mock('../import-record', () => ({
	ImportRecordFindOrFailCommand: class ImportRecordFindOrFailCommand {},
	ImportRecordUpdateOrCreateCommand: class ImportRecordUpdateOrCreateCommand {
		constructor(readonly input: unknown) {}
	}
}));

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ImportService } from './import.service';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordUpdateOrCreateCommand } from '../import-record';

/**
 * A table without a tenant column holds rows every tenant shares: the integration catalogue, the features, the
 * countries and currencies, the plugin marketplace, the tenants themselves. An import wrote an archive's rows into them
 * like into any other table, so a tenant administrator could add rows every tenant sees (a new "integration", a
 * featured marketplace plugin) or, with a second import of a row whose id the first one mapped, rewrite an existing
 * one (the GitHub integration's links) for the whole installation.
 */
const GITHUB = { id: 'c0000000-0000-4000-8000-00000000000c', name: 'GitHub', redirectUrl: 'https://github.com' };
const TIME_TRACKING = { id: 'f0000000-0000-4000-8000-00000000000f', code: 'FEATURE_TIME_TRACKING' };

function sharedTable(tableName: string, rows: Record<string, unknown>[], uniqueConstraints: string[][] = []) {
	const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
		Object.entries(where).every(([key, value]) => row[key] === value);
	const repository = {
		metadata: { tableName, columns: [], findColumnWithPropertyName: () => undefined },
		findOne: jest.fn(
			async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null
		),
		save: jest.fn(),
		create: jest.fn(),
		query: jest.fn()
	};
	return { repository, uniqueConstraints, foreignKeys: [], isCheckRelation: false, relations: [] as unknown[] };
}

function tenantTable(tableName: string) {
	return {
		repository: {
			metadata: {
				tableName,
				columns: [],
				findColumnWithPropertyName: (name: string) => (name === 'tenantId' ? { propertyName: name } : undefined)
			},
			query: jest.fn()
		},
		uniqueConstraints: [],
		foreignKeys: [],
		isCheckRelation: false,
		relations: [] as unknown[]
	};
}

function buildService(tables: unknown[] = []) {
	const execute = jest.fn(async (command: unknown) =>
		command instanceof ImportEntityFieldMapOrCreateCommand ? { id: 'created-row' } : undefined
	);
	const repositoriesService: any = {
		baseEntityRelationFields: [],
		buildRepositoriesRelationsGraph: jest.fn(async () => tables)
	};
	const service = new ImportService({ execute } as any, repositoriesService);
	const writes = () =>
		execute.mock.calls.filter(([command]) => command instanceof ImportEntityFieldMapOrCreateCommand);
	const mappings = () =>
		execute.mock.calls
			.map(([command]) => command)
			.filter((command) => command instanceof ImportRecordUpdateOrCreateCommand)
			.map((command) => (command as unknown as { input: Record<string, unknown> }).input);
	return { service, execute, writes, mappings };
}

describe('ImportService — rows every tenant shares are never written by an import', () => {
	it('maps an archive row to the shared row with the same unique key, and changes nothing', async () => {
		const integration = sharedTable('integration', [GITHUB], [['name']]);
		const { service, writes, mappings } = buildService();

		await service.migrateImportEntityRecord(integration as any, {
			id: 'source-github',
			name: 'GitHub',
			redirectUrl: 'https://attacker.example'
		});

		expect(writes()).toEqual([]);
		expect(integration.repository.save).not.toHaveBeenCalled();
		expect(mappings()).toEqual([
			expect.objectContaining({ sourceId: 'source-github', destinationId: GITHUB.id, entityType: 'integration' })
		]);
	});

	it('creates no shared row for an archive row that matches none', async () => {
		const integration = sharedTable('integration', [GITHUB], [['name']]);
		const { service, writes, mappings } = buildService();

		await service.migrateImportEntityRecord(integration as any, {
			id: 'source-fake',
			name: 'Totally Real Integration',
			redirectUrl: 'https://attacker.example'
		});

		expect(writes()).toEqual([]);
		expect(integration.repository.save).not.toHaveBeenCalled();
		expect(integration.repository.create).not.toHaveBeenCalled();
		expect(mappings()).toEqual([]);
	});

	it('does not save over the shared row an earlier import mapped, when the second archive renames it', async () => {
		// The second archive gives the mapped id a name no row has, so the unique lookup misses: before, the
		// handler then found the earlier import record and saved the archive row over the real GitHub integration.
		const integration = sharedTable('integration', [GITHUB], [['name']]);
		const { service, writes } = buildService();

		await service.migrateImportEntityRecord(integration as any, {
			id: 'source-github',
			name: 'GitHub2',
			redirectUrl: 'https://attacker.example',
			isActive: 'false'
		});

		expect(writes()).toEqual([]);
		expect(integration.repository.save).not.toHaveBeenCalled();
	});

	it('maps an archive of this instance by id, and another instance’s by natural key', async () => {
		const feature = sharedTable('feature', [TIME_TRACKING]);
		const { service, writes, mappings } = buildService();

		await service.migrateImportEntityRecord(feature as any, {
			id: TIME_TRACKING.id,
			code: 'FEATURE_TIME_TRACKING'
		});
		await service.migrateImportEntityRecord(feature as any, {
			id: 'b0000000-0000-4000-8000-00000000000b',
			code: 'FEATURE_TIME_TRACKING'
		});

		expect(writes()).toEqual([]);
		expect(mappings().map(({ destinationId }) => destinationId)).toEqual([TIME_TRACKING.id, TIME_TRACKING.id]);
	});

	it('never looks a non-UUID archive id up as an id', async () => {
		const feature = sharedTable('feature', [TIME_TRACKING]);
		const { service } = buildService();

		await service.migrateImportEntityRecord(feature as any, { id: "x' OR '1'='1", code: 'FEATURE_UNKNOWN' });

		expect(feature.repository.findOne).toHaveBeenCalledTimes(1);
		expect(feature.repository.findOne).toHaveBeenCalledWith({ where: { code: 'FEATURE_UNKNOWN' } });
	});

	it('still creates or maps a tenant’s own rows through the import command', async () => {
		const { service, writes } = buildService();

		await service.migrateImportEntityRecord(tenantTable('tag') as any, { id: 'source-tag', name: 'Urgent' });

		expect(writes()).toHaveLength(1);
	});

	describe('parse', () => {
		let extractPath: string;

		beforeEach(async () => {
			extractPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'shared-tables-'));
			fs.writeFileSync(path.join(extractPath, 'integration.csv'), 'id,name\nsource-github,GitHub\n');
			fs.writeFileSync(path.join(extractPath, 'tag.csv'), 'id,name\nsource-tag,Urgent\n');
		});

		afterEach(async () => {
			await fsp.rm(extractPath, { recursive: true, force: true });
		});

		it('neither cleans up nor links the junction tables of a shared table', async () => {
			const integration = sharedTable('integration', [GITHUB], [['name']]);
			integration.relations = [{ joinTableName: 'integration_integration_type', foreignKeys: [] }];
			const tag = tenantTable('tag');
			tag.relations = [{ joinTableName: 'tag_task', foreignKeys: [] }];
			const { service } = buildService([integration, tag]);
			const junctions = jest.spyOn(service, 'parseRelationalTables').mockResolvedValue(undefined);
			jest.spyOn(console, 'log').mockImplementation(() => undefined);

			await service.parse(extractPath, true);

			expect(integration.repository.query).not.toHaveBeenCalled();
			expect(tag.repository.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "tag"'));
			expect(junctions.mock.calls.map(([, owner]) => owner)).toEqual([tag]);
			jest.restoreAllMocks();
		});
	});
});
