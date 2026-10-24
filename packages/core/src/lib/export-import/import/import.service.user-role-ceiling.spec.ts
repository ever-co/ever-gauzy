import 'reflect-metadata';

const mockCaller: { userId: string; role: string; permissions: string[] } = {
	userId: 'u0000000-0000-4000-8000-0000000000ad',
	role: 'ADMIN',
	permissions: []
};

jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));
jest.mock('../../core/context', () => ({
	RequestContext: {
		currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a',
		currentUserId: () => mockCaller.userId,
		currentRoleName: () => mockCaller.role,
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
		constructor(readonly input: { sourceId?: string; destinationId?: string; entityType?: string }) {}
	}
}));

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { ImportService } from './import.service';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordFindOrFailCommand, ImportRecordUpdateOrCreateCommand } from '../import-record';

const TENANT = 'a0000000-0000-4000-8000-00000000000a';
const IMPORTER = mockCaller.userId;

/** A bcrypt digest of a password the importer knows. */
const KNOWN_HASH = '$2b$10$knownknownknownknownknuW5oZxQ8lDq0bS2l8m5qkq3r2r1r0r9';

/** The importing tenant's roles, by id. */
const TENANT_ROLES: Record<string, { name: string; isSystem: boolean }> = {
	'role-super': { name: RolesEnum.SUPER_ADMIN, isSystem: true },
	'role-admin': { name: RolesEnum.ADMIN, isSystem: true },
	'role-employee': { name: RolesEnum.EMPLOYEE, isSystem: true },
	'role-custom': { name: 'Reviewer', isSystem: false }
};

/** The tenant's users, by id, with their stored role and e-mail. */
const TENANT_USERS: Record<string, { id: string; roleId: string; email: string }> = {
	'user-root': { id: 'user-root', roleId: 'role-super', email: 'root@example.com' },
	'user-employee': { id: 'user-employee', roleId: 'role-employee', email: 'employee@example.com' },
	[IMPORTER]: { id: IMPORTER, roleId: 'role-admin', email: 'admin@example.com' }
};

/** The tenant's invitations, by id: one an earlier import may have mapped an archive id to. */
const TENANT_INVITES: Record<string, { id: string; roleId: string; email: string }> = {
	'invite-root': { id: 'invite-root', roleId: 'role-employee', email: 'root@example.com' }
};

/** A table as the repository graph describes it. */
function table(
	tableName: string,
	columns: string[],
	foreignKeys: { column: string; repository: { metadata: { tableName: string } } }[] = [],
	findOne: (options: { where: Record<string, unknown> }) => Promise<unknown> = async () => null
) {
	return {
		repository: {
			metadata: {
				tableName,
				columns: columns.map((propertyName) => ({
					propertyName,
					type: propertyName === 'isSystem' ? Boolean : String
				})),
				findColumnWithPropertyName: (name: string) => (name === 'tenantId' ? { propertyName: name } : undefined)
			},
			query: jest.fn(),
			findOne: jest.fn(findOne)
		},
		uniqueConstraints: [] as string[][],
		foreignKeys,
		isCheckRelation: foreignKeys.length > 0,
		relations: [] as unknown[]
	};
}

const ROLE_FOREIGN_KEY = [{ column: 'roleId', repository: { metadata: { tableName: 'role' } } }];

/**
 * @param importRecords - The archive ids an earlier import of the tenant mapped (`<table>:<sourceId>`), and the row
 * each was mapped to.
 */
function buildService(importRecords: Record<string, string> = {}) {
	const records: Record<string, string> = { ...importRecords };
	const roles: Record<string, { name: string; isSystem: boolean }> = { ...TENANT_ROLES };

	const roleOf = (id: unknown) => (typeof id === 'string' && roles[id] ? { id, ...roles[id] } : null);
	const withRole = (row: { id: string; roleId: string } | undefined) =>
		row ? { ...row, role: roleOf(row.roleId) } : null;

	const execute = jest.fn(async (command: any) => {
		if (command instanceof ImportEntityFieldMapOrCreateCommand) {
			const [repository, , row, sourceId] = (command as unknown as { args: any[] }).args;
			const id = `created-${repository.metadata.tableName}-${sourceId}`;
			if (repository.metadata.tableName === 'role') {
				roles[id] = { name: row.name, isSystem: false };
			}
			return { id };
		}
		if (command instanceof ImportRecordFindOrFailCommand) {
			const destinationId = records[`${command.input.entityType}:${command.input.sourceId}`];
			return destinationId
				? { success: true, record: { destinationId } }
				: { success: false, error: new NotFoundException('The import record was not found') };
		}
		if (command instanceof ImportRecordUpdateOrCreateCommand) {
			const { entityType, sourceId, destinationId } = command.input;
			records[`${entityType}:${sourceId}`] = destinationId;
			return { success: true };
		}
		return undefined;
	});

	const typeOrmRoleRepository = {
		findOne: jest.fn(async ({ where }: { where: { id?: string; name?: string; tenantId?: string } }) => {
			if (where.tenantId !== TENANT) {
				return null;
			}
			if (where.id) {
				return roleOf(where.id);
			}
			const [id] = Object.entries(roles).find(([, role]) => role.name === where.name) ?? [];
			return id ? roleOf(id) : null;
		})
	};

	const roleTable = table('role', ['name', 'isSystem']);
	const userTable = table('user', ['email', 'hash', 'roleId'], ROLE_FOREIGN_KEY, async ({ where }) =>
		where.tenantId === TENANT ? withRole(TENANT_USERS[where.id as string]) : null
	);
	const inviteTable = table('invite', ['email', 'token', 'roleId'], ROLE_FOREIGN_KEY, async ({ where }) =>
		where.tenantId === TENANT ? withRole(TENANT_INVITES[where.id as string]) : null
	);

	/** The tenant's users of an e-mail, matched case-insensitively as the `LOWER(…) = LOWER(:email)` it gets. */
	const typeOrmUserRepository = {
		find: jest.fn(async ({ where }: { where: { tenantId?: string; email?: FindOperator<string> } }) => {
			const email = String(where.email?.objectLiteralParameters?.['email'] ?? '').toLowerCase();
			return where.tenantId === TENANT
				? Object.values(TENANT_USERS)
						.filter((user) => user.email.toLowerCase() === email)
						.map(withRole)
				: [];
		})
	};

	const repositoriesService: any = {
		baseEntityRelationFields: [],
		buildRepositoriesRelationsGraph: jest.fn(async () => [roleTable, userTable, inviteTable]),
		typeOrmRoleRepository,
		typeOrmUserRepository
	};
	const service = new ImportService({ execute } as any, repositoriesService);

	const commands = () => execute.mock.calls.map(([command]) => command);
	/** What reached the write, per archive row: its table, its id in the archive and the row. */
	const written = (tableName?: string) =>
		commands()
			.filter((command) => command instanceof ImportEntityFieldMapOrCreateCommand)
			.map((command) => {
				const [repository, , row, sourceId] = (command as unknown as { args: any[] }).args;
				return { table: repository.metadata.tableName as string, sourceId: sourceId as string, row };
			})
			.filter((write) => !tableName || write.table === tableName);
	/** The import records written for a table: archive id -> the row it was mapped to. */
	const mapped = (tableName: string) =>
		Object.fromEntries(
			commands()
				.filter((command) => command instanceof ImportRecordUpdateOrCreateCommand)
				.map((command) => (command as unknown as { input: Record<string, string> }).input)
				.filter((input) => input.entityType === tableName)
				.map((input) => [input.sourceId, input.destinationId])
		);
	return { service, written, mapped, roleTable, userTable, inviteTable };
}

/**
 * `POST /import` (IMPORT_ADD, an ADMIN's by default) wrote an archive's `role`, `user` and `invite` rows like any other
 * table's. A hand-built archive therefore let an ADMIN:
 * - create a role named SUPER_ADMIN (the table has no unique key to match on), which every guard reads by name;
 * - create a user, with a password hash of their choosing, holding it or the tenant's real SUPER_ADMIN role;
 * - save over the SUPER_ADMIN user's own row through an archive id an earlier import mapped to it;
 * - plant an invitation with a known token for the SUPER_ADMIN role.
 * The role, user and invite APIs refuse all of these (role name rules R7-01, the role ceiling of
 * ever-co/ever-gauzy#11318). The import now writes those rows by the same rules, and skips the rest; a SUPER_ADMIN
 * imports as before. The role permissions follow the same pattern (ever-co/ever-gauzy#11376).
 */
describe('ImportService — users, roles and invitations are imported under the role ceiling', () => {
	let extractPath: string;

	const writeCsv = (name: string, lines: string[]) =>
		fs.writeFileSync(path.join(extractPath, `${name}.csv`), lines.join('\n') + '\n');

	const ADMIN_PERMISSIONS = [
		PermissionsEnum.IMPORT_ADD,
		PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
		PermissionsEnum.ORG_USERS_EDIT,
		PermissionsEnum.ORG_INVITE_EDIT
	];

	beforeEach(async () => {
		mockCaller.role = RolesEnum.ADMIN;
		mockCaller.permissions = [...ADMIN_PERMISSIONS];
		extractPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'user-role-ceiling-'));
		writeCsv('role', [
			'id,name,isSystem',
			'src-super,SUPER_ADMIN,true',
			'src-admin,ADMIN,true',
			'src-employee,EMPLOYEE,true',
			// A role the tenant creates: what POST /roles lets an ADMIN write
			'src-custom,Auditor,false',
			// A platform role's name in another case: still a platform role
			'src-fake-super,Super_Admin,false'
		]);
		writeCsv('user', [
			'id,email,hash,roleId',
			`src-u-super,root2@example.com,${KNOWN_HASH},src-super`,
			`src-u-fake,fake@example.com,${KNOWN_HASH},src-fake-super`,
			`src-u-admin,admin2@example.com,${KNOWN_HASH},src-admin`,
			`src-u-employee,employee2@example.com,${KNOWN_HASH},src-employee`,
			'src-u-auditor,auditor@example.com,,src-custom'
		]);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(async () => {
		await fsp.rm(extractPath, { recursive: true, force: true });
		jest.restoreAllMocks();
	});

	describe('role.csv', () => {
		it("never writes a platform role: maps the ones an ADMIN could grant to the tenant's own", async () => {
			const { service, written, mapped } = buildService();

			await service.parse(extractPath, false);

			// The failure scenario: `src-super` / `src-fake-super` used to create roles named SUPER_ADMIN
			expect(written('role').map(({ sourceId }) => sourceId)).toEqual(['src-custom']);
			expect(mapped('role')).toEqual({
				'src-admin': 'role-admin',
				'src-employee': 'role-employee',
				'src-custom': 'created-role-src-custom'
			});
		});

		it('writes a role the tenant created without isSystem, which is not a caller to set', async () => {
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			expect(written('role')[0].row).toEqual(expect.objectContaining({ name: 'Auditor', tenantId: TENANT }));
			expect(written('role')[0].row).not.toHaveProperty('isSystem');
		});

		it('does not save a role over a platform role an earlier import mapped the archive id to', async () => {
			// Saved over the ADMIN role, `Auditor` would rename it away
			const { service, written } = buildService({ 'role:src-custom': 'role-admin' });

			await service.parse(extractPath, false);

			expect(written('role')).toEqual([]);
		});

		it('maps the platform roles but writes no role for an ADMIN without CHANGE_ROLES_PERMISSIONS', async () => {
			mockCaller.permissions = [PermissionsEnum.IMPORT_ADD, PermissionsEnum.ORG_USERS_EDIT];
			const { service, written, mapped } = buildService();

			await service.parse(extractPath, false);

			expect(written('role')).toEqual([]);
			expect(mapped('role')).toEqual({ 'src-admin': 'role-admin', 'src-employee': 'role-employee' });
		});
	});

	describe('user.csv', () => {
		it('creates only the users an ADMIN could create through the API, with a role they could grant', async () => {
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			expect(written('user').map(({ sourceId, row }) => [sourceId, row.roleId])).toEqual([
				['src-u-admin', 'role-admin'],
				['src-u-employee', 'role-employee'],
				['src-u-auditor', 'created-role-src-custom']
			]);
		});

		it('keeps the hash of a user within the ceiling: the API lets the importer set that password', async () => {
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			expect(written('user').find(({ sourceId }) => sourceId === 'src-u-employee').row.hash).toBe(KNOWN_HASH);
		});

		it("does not create a user with the tenant's SUPER_ADMIN role, mapped by an earlier import", async () => {
			// A SUPER_ADMIN's earlier import of the same archive mapped `src-super` to the real SUPER_ADMIN role.
			fs.rmSync(path.join(extractPath, 'role.csv'));
			const { service, written } = buildService({
				'role:src-super': 'role-super',
				'role:src-admin': 'role-admin'
			});

			await service.parse(extractPath, false);

			expect(written('user').map(({ sourceId }) => sourceId)).toEqual(['src-u-admin']);
			expect(written('user').some(({ row }) => row.roleId === 'role-super')).toBe(false);
		});

		it("does not save over the SUPER_ADMIN user's row an earlier import mapped the archive id to", async () => {
			// The archive row names a role the ADMIN may grant; saved over the SUPER_ADMIN user, it would replace their
			// hash and e-mail, and demote them.
			const { service, written } = buildService({ 'user:src-u-employee': 'user-root' });

			await service.parse(extractPath, false);

			expect(written('user').map(({ sourceId }) => sourceId)).not.toContain('src-u-employee');
		});

		it('saves over an existing user within the ceiling, as PUT /user/:id lets an ADMIN', async () => {
			const { service, written } = buildService({ 'user:src-u-admin': 'user-employee' });

			await service.parse(extractPath, false);

			expect(written('user').map(({ sourceId }) => sourceId)).toContain('src-u-admin');
		});

		it("does not change the importer's own role", async () => {
			writeCsv('user', ['id,email,roleId', 'src-u-me,admin@example.com,src-employee']);
			const { service, written } = buildService({ 'user:src-u-me': IMPORTER });

			await service.parse(extractPath, false);

			expect(written('user')).toEqual([]);
		});

		it('drops the role and tenant relations of a row, so only the judged columns reach the save', async () => {
			writeCsv('user', [
				'id,email,roleId,role,tenant',
				'src-u-employee,e@example.com,src-employee,role-super,tenant-other'
			]);
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			expect(written('user')).toHaveLength(1);
			expect(written('user')[0].row).toEqual(expect.objectContaining({ roleId: 'role-employee' }));
			expect(written('user')[0].row).not.toHaveProperty('role');
			expect(written('user')[0].row).not.toHaveProperty('tenant');
		});

		it('writes no user for an importer without ORG_USERS_EDIT, which POST /user takes', async () => {
			mockCaller.permissions = [PermissionsEnum.IMPORT_ADD, PermissionsEnum.CHANGE_ROLES_PERMISSIONS];
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			expect(written('user')).toEqual([]);
		});
	});

	describe('invite.csv', () => {
		beforeEach(() =>
			writeCsv('invite', [
				'id,email,token,roleId',
				'src-i-super,someone@example.com,known-token-1,src-super',
				'src-i-employee,someone-else@example.com,known-token-2,src-employee'
			])
		);

		it('writes only the invitations an ADMIN could issue', async () => {
			// Even with `src-super` mapped to the real SUPER_ADMIN role by an earlier import
			const { service, written } = buildService({ 'role:src-super': 'role-super' });

			await service.parse(extractPath, false);

			expect(written('invite').map(({ sourceId, row }) => [sourceId, row.roleId])).toEqual([
				['src-i-employee', 'role-employee']
			]);
		});

		it('writes no invitation for an importer who may not invite', async () => {
			mockCaller.permissions = [PermissionsEnum.IMPORT_ADD, PermissionsEnum.ORG_USERS_EDIT];
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			expect(written('invite')).toEqual([]);
		});

		// `POST /invite/accept` signs the invitee into the tenant's user of the invitation's e-mail, and the archive
		// states the code or token: an allowed role on an invitation to a SUPER_ADMIN's address signed in as them.
		it("does not write an invitation addressed to the SUPER_ADMIN user's e-mail, whatever role it names", async () => {
			writeCsv('invite', [
				'id,email,token,roleId',
				'src-i-root,Root@Example.com,known-token-3,src-employee',
				'src-i-employee,employee@example.com,known-token-2,src-employee'
			]);
			const { service, written } = buildService();

			await service.parse(extractPath, false);

			// The invitation to an existing user within the ceiling stands, as `POST /invite/emails` issues it.
			expect(written('invite').map(({ sourceId }) => sourceId)).toEqual(['src-i-employee']);
		});

		it('does not save an invitation stating no e-mail over a stored one addressed to the SUPER_ADMIN', async () => {
			writeCsv('invite', ['id,token,roleId', 'src-i-employee,known-token-2,src-employee']);
			const { service, written } = buildService({ 'invite:src-i-employee': 'invite-root' });

			await service.parse(extractPath, false);

			expect(written('invite')).toEqual([]);
		});
	});

	describe('a clean import', () => {
		it("refuses an ADMIN's clean import of a bare user.csv before any user is deleted", async () => {
			fs.rmSync(path.join(extractPath, 'role.csv'));
			const { service, written, userTable } = buildService();

			await expect(service.parse(extractPath, true)).rejects.toBeInstanceOf(ForbiddenException);

			expect(userTable.repository.query).not.toHaveBeenCalled();
			expect(written()).toEqual([]);
		});

		it('refuses a header-only invite.csv from an importer who may not invite, before anything is deleted', async () => {
			mockCaller.permissions = [PermissionsEnum.IMPORT_ADD];
			fs.rmSync(path.join(extractPath, 'role.csv'));
			fs.rmSync(path.join(extractPath, 'user.csv'));
			writeCsv('invite', ['id,email,token,roleId']);
			const { service, inviteTable } = buildService();

			await expect(service.parse(extractPath, true)).rejects.toBeInstanceOf(ForbiddenException);

			expect(inviteTable.repository.query).not.toHaveBeenCalled();
		});

		it("cleans up and writes a SUPER_ADMIN's clean import of users and invitations, as before", async () => {
			mockCaller.role = RolesEnum.SUPER_ADMIN;
			mockCaller.permissions = [PermissionsEnum.IMPORT_ADD];
			writeCsv('invite', ['id,email,token,roleId', 'src-i-super,root@example.com,known-token,src-super']);
			const { service, written, userTable, inviteTable } = buildService();

			await service.parse(extractPath, true);

			expect(userTable.repository.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "user"'));
			expect(inviteTable.repository.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "invite"'));
			expect(written('user')).toHaveLength(5);
			expect(written('invite').map(({ sourceId }) => sourceId)).toEqual(['src-i-super']);
		});
	});

	it('writes no role, user or invitation for a custom role granted IMPORT_ADD (the lowest level)', async () => {
		mockCaller.role = 'Reviewer';
		mockCaller.permissions = [...ADMIN_PERMISSIONS];
		writeCsv('invite', ['id,email,token,roleId', 'src-i-employee,someone@example.com,known-token,src-employee']);
		const { service, written, mapped } = buildService();

		await service.parse(extractPath, false);

		expect(written()).toEqual([]);
		expect(mapped('role')).toEqual({});
	});

	it("writes every row of a SUPER_ADMIN's archive as before, hashes included: the top role", async () => {
		mockCaller.role = RolesEnum.SUPER_ADMIN;
		mockCaller.permissions = [PermissionsEnum.IMPORT_ADD];
		writeCsv('invite', ['id,email,token,roleId', 'src-i-super,someone@example.com,known-token,src-super']);
		const { service, written } = buildService();

		await service.parse(extractPath, false);

		expect(written('role').map(({ sourceId }) => sourceId)).toEqual([
			'src-super',
			'src-admin',
			'src-employee',
			'src-custom',
			'src-fake-super'
		]);
		expect(written('role')[0].row).toEqual(expect.objectContaining({ name: 'SUPER_ADMIN', isSystem: true }));
		expect(written('user').map(({ sourceId }) => sourceId)).toEqual([
			'src-u-super',
			'src-u-fake',
			'src-u-admin',
			'src-u-employee',
			'src-u-auditor'
		]);
		expect(written('user')[0].row).toEqual(
			expect.objectContaining({ hash: KNOWN_HASH, roleId: 'created-role-src-super' })
		);
		expect(written('invite').map(({ sourceId }) => sourceId)).toEqual(['src-i-super']);
	});
});
