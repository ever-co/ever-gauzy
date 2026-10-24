import 'reflect-metadata';

const mockCaller: { role: string; permissions: string[] } = { role: 'ADMIN', permissions: [] };

jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));
jest.mock('../../core/context', () => ({
	RequestContext: {
		currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a',
		currentUserId: () => 'u0000000-0000-4000-8000-00000000000u',
		hasRole: (role: string) => mockCaller.role === role,
		hasPermission: (permission: string) => mockCaller.permissions.includes(permission)
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
		constructor(readonly input: { sourceId?: string; entityType?: string }) {}
	},
	ImportRecordUpdateOrCreateCommand: class ImportRecordUpdateOrCreateCommand {
		constructor(readonly input: unknown) {}
	}
}));

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { ImportService } from './import.service';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordFindOrFailCommand } from '../import-record';

const TENANT = 'a0000000-0000-4000-8000-00000000000a';

/** The importing tenant's roles, by id. */
const ROLES: Record<string, RolesEnum | string> = {
	'role-custom': 'CUSTOM',
	'role-admin': RolesEnum.ADMIN,
	'role-super': RolesEnum.SUPER_ADMIN
};

/** The archive's roles, as an earlier import of the archive's `role.csv` mapped them to the tenant's. */
const ROLE_IMPORT_RECORDS: Record<string, string> = {
	'role:src-role-custom': 'role-custom',
	'role:src-role-admin': 'role-admin',
	'role:src-role-super': 'role-super'
};

/** The `role_permission` table as the repository graph describes it: its role is a foreign key to `role`. */
function rolePermissionTable() {
	return {
		repository: {
			metadata: {
				tableName: 'role_permission',
				columns: [
					{ propertyName: 'permission', type: String },
					{ propertyName: 'enabled', type: Boolean },
					{ propertyName: 'roleId', type: String }
				],
				findColumnWithPropertyName: (name: string) => (name === 'tenantId' ? { propertyName: name } : undefined)
			},
			query: jest.fn()
		},
		// The unique index (tenant, role, permission) is not a `@Unique` constraint: the graph finds none.
		uniqueConstraints: [] as string[][],
		foreignKeys: [{ column: 'roleId', repository: { metadata: { tableName: 'role' } } }],
		isCheckRelation: true,
		relations: [] as unknown[]
	};
}

/**
 * @param importRecords - The archive ids an earlier import of the tenant mapped (`<table>:<sourceId>`), and the row
 * each was mapped to.
 * @param stored - The tenant's stored `role_permission` rows, by id.
 */
function buildService(importRecords: Record<string, string> = {}, stored: Record<string, Record<string, any>> = {}) {
	const records = { ...ROLE_IMPORT_RECORDS, ...importRecords };
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof ImportEntityFieldMapOrCreateCommand) {
			return { id: 'created-row' };
		}
		if (command instanceof ImportRecordFindOrFailCommand) {
			const destinationId = records[`${command.input.entityType}:${command.input.sourceId}`];
			return destinationId
				? { success: true, record: { destinationId } }
				: { success: false, error: new NotFoundException('The import record was not found') };
		}
		return undefined;
	});
	const typeOrmRoleRepository = {
		findOne: jest.fn(async ({ where }: { where: { id?: string; tenantId?: string } }) =>
			where.id && ROLES[where.id] && where.tenantId === TENANT ? { id: where.id, name: ROLES[where.id] } : null
		)
	};
	const typeOrmRolePermissionRepository = {
		findOne: jest.fn(async ({ where }: { where: { id: string } }) => stored[where.id] ?? null)
	};
	const table = rolePermissionTable();
	const repositoriesService: any = {
		baseEntityRelationFields: [],
		buildRepositoriesRelationsGraph: jest.fn(async () => [table]),
		typeOrmRoleRepository,
		typeOrmRolePermissionRepository
	};
	const service = new ImportService({ execute } as any, repositoriesService);

	/** What reached the write, per archive row: its id in the archive, the upsert's conditions and the row. */
	const written = () =>
		execute.mock.calls
			.map(([command]) => command)
			.filter((command) => command instanceof ImportEntityFieldMapOrCreateCommand)
			.map((command) => {
				const [, where, row, sourceId] = (command as unknown as { args: any[] }).args;
				return { sourceId, where, row };
			});
	return { service, written, typeOrmRolePermissionRepository, table };
}

/**
 * `POST /import` (IMPORT_ADD, an ADMIN's by default) wrote an archive's `role_permission` rows like any other table's,
 * so a crafted archive (a hand-built ZIP is accepted) enabled on an ADMIN or a custom role a permission the importing
 * ADMIN does not hold (`SUPER_ADMIN_EDIT`, `GLOBAL_SETTING`, `PAYMENT_PROVIDERS_EDIT`, ...), which they could then give
 * to a user they control. The role-permission API refuses that (ever-co/ever-gauzy#11232) and refuses an ADMIN any
 * change to the SUPER_ADMIN and ADMIN roles' permissions (SEC-A-07). The import now writes these rows by the same
 * rules, and skips the rest.
 *
 * The table's unique key, an index rather than a `@Unique` constraint, was also invisible to the import, so its
 * upsert had no conditions and every archive row was created afresh: the key is now (tenant, role, permission).
 */
describe('ImportService — role permissions are imported under the role-permission rules', () => {
	let extractPath: string;

	const writeArchive = (csv: string) => fs.writeFileSync(path.join(extractPath, 'role_permission.csv'), csv);

	beforeEach(async () => {
		mockCaller.role = RolesEnum.ADMIN;
		mockCaller.permissions = [
			PermissionsEnum.IMPORT_ADD,
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
			PermissionsEnum.ORG_EMPLOYEES_VIEW
		];
		extractPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'role-permission-ceiling-'));
		writeArchive(
			[
				'id,roleId,permission,enabled',
				// A permission the ADMIN holds, on a custom role: what the API lets them do
				`src-held,src-role-custom,${PermissionsEnum.ORG_EMPLOYEES_VIEW},true`,
				// The failure scenario: a permission only SUPER_ADMIN holds, enabled on a custom role
				`src-ceiling,src-role-custom,${PermissionsEnum.SUPER_ADMIN_EDIT},true`,
				// Turning a permission off is never refused
				`src-off,src-role-custom,${PermissionsEnum.GLOBAL_SETTING},false`,
				// The ADMIN role's own permissions, and the SUPER_ADMIN's, are not an ADMIN's to change
				`src-admin,src-role-admin,${PermissionsEnum.ORG_EMPLOYEES_VIEW},true`,
				`src-super,src-role-super,${PermissionsEnum.CHANGE_ROLES_PERMISSIONS},false`,
				// A role the archive does not map to one of the tenant's
				`src-unmapped,src-role-elsewhere,${PermissionsEnum.ORG_EMPLOYEES_VIEW},true`
			].join('\n') + '\n'
		);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		await fsp.rm(extractPath, { recursive: true, force: true });
		jest.restoreAllMocks();
	});

	it("writes only the rows an ADMIN could write through the API, on the tenant's own roles", async () => {
		const { service, written } = buildService();

		await service.parse(extractPath, false);

		expect(written().map(({ sourceId }) => sourceId)).toEqual(['src-held', 'src-off']);
		expect(written().map(({ row }) => [row.roleId, row.permission, row.enabled])).toEqual([
			['role-custom', PermissionsEnum.ORG_EMPLOYEES_VIEW, true],
			['role-custom', PermissionsEnum.GLOBAL_SETTING, false]
		]);
	});

	it('matches an archive row on the role as well as the permission, within the tenant', async () => {
		const { service, written } = buildService();

		await service.parse(extractPath, false);

		// The upsert's conditions used to be empty, so even a row the role already held was created again
		expect(written()[0].where).toEqual([
			{ tenantId: TENANT, roleId: 'role-custom', permission: PermissionsEnum.ORG_EMPLOYEES_VIEW }
		]);
	});

	it("does not write over a row of the ADMIN role an earlier import mapped the archive's id to", async () => {
		// The archive row names a custom role and turns its permission off; saved over the mapped row, it would move
		// the ADMIN role's permission away.
		const { service, written } = buildService(
			{ 'role_permission:src-off': 'row-of-admin' },
			{
				'row-of-admin': {
					id: 'row-of-admin',
					roleId: 'role-admin',
					role: { id: 'role-admin', name: RolesEnum.ADMIN },
					permission: PermissionsEnum.GLOBAL_SETTING,
					enabled: true
				}
			}
		);

		await service.parse(extractPath, false);

		expect(written().map(({ sourceId }) => sourceId)).toEqual(['src-held']);
	});

	it('judges a row saved over a mapped row as it will stand, with the stored role and flag', async () => {
		// The archive row names only the permission: saved over the custom role's enabled row, it would enable
		// SUPER_ADMIN_EDIT on that role.
		writeArchive(['id,permission', `src-renamed,${PermissionsEnum.SUPER_ADMIN_EDIT}`].join('\n') + '\n');
		const { service, written, typeOrmRolePermissionRepository } = buildService(
			{ 'role_permission:src-renamed': 'row-of-custom' },
			{
				'row-of-custom': {
					id: 'row-of-custom',
					roleId: 'role-custom',
					role: { id: 'role-custom', name: 'CUSTOM' },
					permission: PermissionsEnum.ORG_EMPLOYEES_VIEW,
					enabled: true
				}
			}
		);

		await service.parse(extractPath, false);

		expect(written()).toEqual([]);
		expect(typeOrmRolePermissionRepository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'row-of-custom', tenantId: TENANT }, withDeleted: true })
		);
	});

	it('writes no role permission for an ADMIN who may not change role permissions', async () => {
		mockCaller.permissions = [PermissionsEnum.IMPORT_ADD, PermissionsEnum.ORG_EMPLOYEES_VIEW];
		const { service, written } = buildService();

		await service.parse(extractPath, false);

		expect(written()).toEqual([]);
	});

	it('writes no role permission for a custom role granted IMPORT_ADD', async () => {
		mockCaller.role = 'CUSTOM';
		mockCaller.permissions = [
			PermissionsEnum.IMPORT_ADD,
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
			PermissionsEnum.ORG_EMPLOYEES_VIEW
		];
		const { service, written } = buildService();

		await service.parse(extractPath, false);

		expect(written()).toEqual([]);
	});

	it("writes every row of a SUPER_ADMIN's archive, as before: the top role is unbounded", async () => {
		mockCaller.role = RolesEnum.SUPER_ADMIN;
		mockCaller.permissions = [PermissionsEnum.IMPORT_ADD];
		const { service, written } = buildService();

		await service.parse(extractPath, false);

		expect(written().map(({ sourceId }) => sourceId)).toEqual([
			'src-held',
			'src-ceiling',
			'src-off',
			'src-admin',
			'src-super',
			'src-unmapped'
		]);
	});

	describe('a clean import', () => {
		// The clean-up deletes the tenant's role permissions, the SUPER_ADMIN and ADMIN roles' included, and the rule
		// above lets only a SUPER_ADMIN write those back: an ADMIN's clean restore left both roles without any.
		it("refuses an ADMIN's clean import of role permissions before anything is deleted", async () => {
			const { service, written, table } = buildService();

			await expect(service.parse(extractPath, true)).rejects.toBeInstanceOf(ForbiddenException);

			expect(table.repository.query).not.toHaveBeenCalled();
			expect(written()).toEqual([]);
		});

		it('refuses it for a header-only role_permission.csv, and for a role.csv, whose delete cascades', async () => {
			writeArchive('id,roleId,permission,enabled\n');
			await expect(buildService().service.parse(extractPath, true)).rejects.toBeInstanceOf(ForbiddenException);

			fs.rmSync(path.join(extractPath, 'role_permission.csv'));
			fs.writeFileSync(path.join(extractPath, 'role.csv'), 'id,name\nsrc-role-admin,ADMIN\n');
			const { service, table } = buildService();
			await expect(service.parse(extractPath, true)).rejects.toBeInstanceOf(ForbiddenException);
			expect(table.repository.query).not.toHaveBeenCalled();
		});

		it("cleans up and writes every row of a SUPER_ADMIN's clean import, as before", async () => {
			mockCaller.role = RolesEnum.SUPER_ADMIN;
			mockCaller.permissions = [PermissionsEnum.IMPORT_ADD];
			const { service, written, table } = buildService();

			await service.parse(extractPath, true);

			expect(table.repository.query).toHaveBeenCalledWith(
				`DELETE FROM "role_permission" WHERE "role_permission"."tenantId" = '${TENANT}'`
			);
			expect(written()).toHaveLength(6);
		});
	});
});
