import 'reflect-metadata';

const mockCaller = { userId: 'u0000000-0000-4000-8000-00000000000u', superAdmin: true };

jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));
jest.mock('../../core/context', () => ({
	RequestContext: {
		currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a',
		currentUserId: () => mockCaller.userId,
		hasRole: () => mockCaller.superAdmin
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
	ImportRecordFindOrFailCommand: class ImportRecordFindOrFailCommand {
		constructor(readonly input: { sourceId?: string }) {}
	},
	ImportRecordUpdateOrCreateCommand: class ImportRecordUpdateOrCreateCommand {
		constructor(readonly input: unknown) {}
	}
}));

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { OPERATOR_USER_IDS_ENV } from '../../tenant/tenant-setting/global-setting-writer';
import { ImportService } from './import.service';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordFindOrFailCommand } from '../import-record';

const TENANT = 'a0000000-0000-4000-8000-00000000000a';
const QUOTA = 'docs.b0000000-0000-4000-8000-00000000000b.quotaBytes';

function tenantSettingTable(rows: Record<string, unknown>[] = []) {
	return {
		repository: {
			metadata: {
				tableName: 'tenant_setting',
				columns: [],
				findColumnWithPropertyName: (name: string) => (name === 'tenantId' ? { propertyName: name } : undefined)
			},
			query: jest.fn(),
			find: jest.fn(async () => rows),
			findOne: jest.fn(
				async ({ where }: { where: { id: string } }) => rows.find((row) => row['id'] === where.id) ?? null
			),
			delete: jest.fn(async () => ({ affected: 0, raw: [] }))
		},
		uniqueConstraints: [],
		foreignKeys: [],
		isCheckRelation: false,
		relations: [] as unknown[]
	};
}

/**
 * @param importRecords - The archive ids an earlier import of the tenant mapped, and the row each was mapped to.
 */
function buildService(tables: unknown[], importRecords: Record<string, string> = {}) {
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof ImportEntityFieldMapOrCreateCommand) {
			return { id: 'created-row' };
		}
		if (command instanceof ImportRecordFindOrFailCommand) {
			const destinationId = importRecords[command.input.sourceId as string];
			if (!destinationId) {
				throw new NotFoundException('The import record was not found');
			}
			return { success: true, record: { destinationId } };
		}
		return undefined;
	});
	const repositoriesService: any = {
		baseEntityRelationFields: [],
		buildRepositoriesRelationsGraph: jest.fn(async () => tables)
	};
	const service = new ImportService({ execute } as any, repositoriesService);
	const writtenNames = () =>
		execute.mock.calls
			.map(([command]) => command)
			.filter((command) => command instanceof ImportEntityFieldMapOrCreateCommand)
			.map((command) => (command as unknown as { args: Record<string, unknown>[] }).args[2]['name']);
	return { service, writtenNames };
}

/**
 * An organization's Documents storage limit is the `tenant_setting` row `docs.<organizationId>.quotaBytes`, which only
 * the installation operator may write (owner decision 14, 2026-10-22). An import writes an archive's `tenant_setting`
 * rows into the importing tenant, so an archive carrying that row set or lifted the limit, and a clean import removed
 * it, which put the deployment default back.
 */
describe('ImportService — the Documents storage limit is not an archive’s to set', () => {
	const savedList = process.env[OPERATOR_USER_IDS_ENV];
	let extractPath: string;

	beforeEach(async () => {
		delete process.env[OPERATOR_USER_IDS_ENV];
		mockCaller.superAdmin = true;
		extractPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'operator-only-settings-'));
		fs.writeFileSync(
			path.join(extractPath, 'tenant_setting.csv'),
			`id,name,value\nsource-quota,${QUOTA},0\nsource-ui,preferredUi,teams\n`
		);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		if (savedList === undefined) delete process.env[OPERATOR_USER_IDS_ENV];
		else process.env[OPERATOR_USER_IDS_ENV] = savedList;
		await fsp.rm(extractPath, { recursive: true, force: true });
		jest.restoreAllMocks();
	});

	it("skips the storage limit row of a tenant super admin's archive and imports the other settings", async () => {
		const table = tenantSettingTable();
		const { service, writtenNames } = buildService([table]);

		await service.parse(extractPath, false);

		expect(writtenNames()).toEqual(['preferredUi']);
	});

	it('imports it for the operator, as before', async () => {
		process.env[OPERATOR_USER_IDS_ENV] = mockCaller.userId;
		const { service, writtenNames } = buildService([tenantSettingTable()]);

		await service.parse(extractPath, false);

		expect(writtenNames()).toEqual([QUOTA, 'preferredUi']);
	});

	it('does not let an ordinary name on the source id of an imported limit row rename that row', async () => {
		// An earlier import (the operator's, or one from before the limit was operator-only) mapped `source-ui` to the
		// limit row. The archive row would be saved over it by that mapping, renaming the limit away.
		const table = tenantSettingTable([{ id: 'row-quota', name: QUOTA }]);
		const { service, writtenNames } = buildService([table], { 'source-ui': 'row-quota' });

		await service.parse(extractPath, false);

		expect(writtenNames()).toEqual([]);
		expect(table.repository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'row-quota' }, withDeleted: true })
		);
	});

	it('imports an ordinary row over the ordinary row an earlier import mapped it to (control)', async () => {
		const table = tenantSettingTable([{ id: 'row-ui', name: 'preferredUi' }]);
		const { service, writtenNames } = buildService([table], { 'source-ui': 'row-ui' });

		await service.parse(extractPath, false);

		expect(writtenNames()).toEqual(['preferredUi']);
	});

	it("lets the operator's import write over a mapped limit row, as before", async () => {
		process.env[OPERATOR_USER_IDS_ENV] = mockCaller.userId;
		const table = tenantSettingTable([{ id: 'row-quota', name: QUOTA }]);
		const { service, writtenNames } = buildService([table], { 'source-ui': 'row-quota' });

		await service.parse(extractPath, false);

		expect(writtenNames()).toEqual([QUOTA, 'preferredUi']);
		expect(table.repository.findOne).not.toHaveBeenCalled();
	});

	it("keeps the tenant's storage limit rows through a clean import by anyone else", async () => {
		const table = tenantSettingTable([
			{ id: 'row-quota', name: QUOTA },
			{ id: 'row-ui', name: 'preferredUi' }
		]);
		const { service } = buildService([table]);

		await service.parse(extractPath, true);

		expect(table.repository.query).not.toHaveBeenCalled();
		expect(table.repository.find).toHaveBeenCalledWith(
			expect.objectContaining({ where: { tenantId: TENANT }, withDeleted: true })
		);
		expect(table.repository.delete).toHaveBeenCalledWith({ tenantId: TENANT, id: Not(In(['row-quota'])) });
	});

	it("wipes every row of the tenant's settings in the operator's clean import, as before", async () => {
		process.env[OPERATOR_USER_IDS_ENV] = mockCaller.userId;
		const table = tenantSettingTable([{ id: 'row-quota', name: QUOTA }]);
		const { service } = buildService([table]);

		await service.parse(extractPath, true);

		expect(table.repository.delete).toHaveBeenCalledWith({ tenantId: TENANT });
	});
});
