import { EntityManager } from 'typeorm';
import { FileStorageProvider, ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { FileStorage } from '../core/file-storage';
import { queryUnlessSchemaLacks, sqlPlaceholder } from '../user/user-authorship';

/**
 * A table whose rows own files in storage, with the columns that hold the storage keys.
 *
 * Deleting rows through the database cascade (a workspace, an account, a reset) runs no entity subscriber,
 * so the files those subscribers would have removed stay in the bucket. Every table here is read before its
 * rows go, and its files are removed explicitly. A table that is not part of this deployment (a disabled
 * plugin) is skipped.
 */
interface FileOwningTable {
	table: string;
	keys: string[];
	/** Columns that make a row one user's own (their captures), for an account deleted from a shared workspace. */
	ownedBy: string[];
	/** Columns naming the member (employee) a row belongs to, e.g. the member a capture was recorded for. */
	ownedByEmployee: string[];
	/** Rows tied to a time slot: the user's captures are also found through their members' time slots. */
	timeSlot: boolean;
	/** Whether a factory reset ("Delete all data") deletes these rows (time-tracking captures). */
	reset: boolean;
	/** The column naming the storage provider of the keys, when it is not `storageProvider`. */
	providerColumn?: string;
}

export const FILE_OWNING_TABLES: ReadonlyArray<FileOwningTable> = [
	{
		table: 'screenshot',
		keys: ['file', 'thumb'],
		ownedBy: ['userId'],
		ownedByEmployee: [],
		timeSlot: true,
		reset: true
	},
	// `userId` on camshots / soundshots is the uploader (an admin may upload for someone else); `uploadedById` is
	// the member they belong to.
	{
		table: 'camshots',
		keys: ['fileKey', 'thumbKey'],
		ownedBy: [],
		ownedByEmployee: ['uploadedById'],
		timeSlot: true,
		reset: true
	},
	{
		table: 'soundshots',
		keys: ['fileKey'],
		ownedBy: [],
		ownedByEmployee: ['uploadedById'],
		timeSlot: true,
		reset: true
	},
	{ table: 'video', keys: ['file'], ownedBy: [], ownedByEmployee: ['uploadedById'], timeSlot: true, reset: true },
	{
		table: 'document',
		keys: ['storageKey', 'thumbKey'],
		ownedBy: [],
		ownedByEmployee: [],
		timeSlot: false,
		reset: false
	},
	{
		table: 'inbox_email_attachment',
		keys: ['storageKey'],
		ownedBy: [],
		ownedByEmployee: [],
		timeSlot: false,
		reset: false
	},
	// The raw message (full MIME / JSON) of every received email; keys are per tenant (`inbox/<tenant>/messages/…`).
	{
		table: 'inbox_email',
		keys: ['rawStorageKey'],
		ownedBy: [],
		ownedByEmployee: [],
		timeSlot: false,
		reset: false,
		providerColumn: 'rawStorageProvider'
	},
	{ table: 'image_asset', keys: ['url', 'thumb'], ownedBy: [], ownedByEmployee: [], timeSlot: false, reset: false }
];

/**
 * Whether a storage key lies under the tenant's own directory. Every upload path puts the tenant id in the key
 * (`screenshots|camshots|soundshots|videos/…/<tenant>/<member>/…`, `uploads/<folder>/<tenant>/…`,
 * `documents/<tenant>/…`, `inbox/<tenant>/…`), while the key column itself is only a string, and one a client can
 * write (`POST /image-assets` stores any `url`). Deleting only keys under the owning tenant keeps a forged key
 * from removing another tenant's file; a key outside it is left in storage.
 */
export function isKeyOfTenant(key: string, tenantId: ID | null | undefined): boolean {
	if (!key || !tenantId) return false;
	const segments = key.split(/[\\/]/);
	// `..` / `.` / empty segments: the local provider normalizes the path, so `uploads/x/<own>/../../<other>/…`
	// would name another tenant's file.
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;
	const position = TENANT_SEGMENT[segments[0]];
	return position !== undefined && segments[position] === tenantId;
}

/** Where each upload path puts the tenant id, by its first segment. */
const TENANT_SEGMENT: Readonly<Record<string, number>> = {
	uploads: 2, // uploads/<folder>/<tenant>/…
	documents: 1, // documents/<tenant>/<organization>/…
	inbox: 1, // inbox/<tenant>/…
	screenshots: 4, // screenshots/YYYY/MM/DD/<tenant>/<member>/…
	camshots: 4,
	soundshots: 4,
	videos: 4
};

/** The files whose keys lie under the tenant's directory (see {@link isKeyOfTenant}). */
export function onlyFilesOfTenant(files: StoredFile[], tenantId: ID | null | undefined): StoredFile[] {
	return files.filter((file) => isKeyOfTenant(file.key, tenantId));
}

/** A file in storage that goes with a deleted row. */
export interface StoredFile {
	table: string;
	provider?: FileStorageProvider | null;
	key: string;
}

/**
 * Whose files: a whole workspace, one user's own (in a workspace that stays), the captures of a reset's
 * organizations, or everything of organizations that are deleted outright.
 */
export type StoredFileScope =
	| { kind: 'workspace'; tenantId: ID }
	| { kind: 'user'; userId: ID }
	| { kind: 'reset'; tenantId: ID; organizationIds: ID[] }
	| { kind: 'organizations'; tenantId: ID; organizationIds: ID[] };

/**
 * The stored files of a scope, read raw (no entity hooks, soft-deleted rows included). Absolute URLs (an
 * avatar on Gravatar, say) are not storage keys and are left out, and so is a key that a row outside the scope
 * still uses (seeded avatars share their files across tenants).
 */
export async function collectStoredFiles(manager: EntityManager, scope: StoredFileScope): Promise<StoredFile[]> {
	const driver = manager.connection.driver;
	const files: StoredFile[] = [];

	for (const owner of FILE_OWNING_TABLES) {
		if (scope.kind === 'reset' && !owner.reset) continue;
		if (scope.kind === 'user' && !owner.ownedBy.length && !owner.ownedByEmployee.length && !owner.timeSlot)
			continue;

		const metadata = manager.connection.entityMetadatas.find((candidate) => candidate.tablePath === owner.table);
		if (!metadata) continue;
		const has = (column: string) => metadata.columns.some((candidate) => candidate.databaseName === column);
		const keys = owner.keys.filter(has);
		if (!keys.length) continue;

		const where = scopeCondition(manager, owner, scope, has);
		if (!where) continue;

		const providerColumn = owner.providerColumn ?? 'storageProvider';
		const select = [
			...keys.map((key) => driver.escape(key)),
			has(providerColumn) ? driver.escape(providerColumn) : 'NULL'
		];
		const rows: Array<Record<string, string>> =
			(await queryUnlessSchemaLacks(
				manager,
				`SELECT ${select.map((column, index) => `${column} AS ${driver.escape(`c${index}`)}`).join(', ')} FROM ${driver.escape(
					owner.table
				)} WHERE ${where.sql}`,
				where.parameters,
				{ table: owner.table, columns: [...keys, ...(has(providerColumn) ? [providerColumn] : [])] }
			)) ?? [];
		for (const row of rows) {
			const provider = row[`c${keys.length}`] as FileStorageProvider;
			for (let index = 0; index < keys.length; index++) {
				const key = row[`c${index}`];
				if (key && !/^https?:\/\//i.test(key)) {
					files.push({ table: owner.table, provider, key });
				}
			}
		}
	}

	return await withoutSharedKeys(manager, files, scope);
}

/**
 * Removes stored files, best effort, with the storage settings of the tenant that owned them (a tenant can
 * keep its own S3 / Wasabi bucket and credentials; without them the provider would look in the deployment's
 * default bucket). The settings are applied the way the HTTP middleware applies them for a signed-in request,
 * then put back.
 *
 * @returns How many were removed and how many could not be.
 */
export async function deleteStoredFiles(
	files: StoredFile[],
	tenantSettings?: Record<string, unknown> | null
): Promise<{ deleted: number; failed: number }> {
	let failed = 0;
	const request = RequestContext.currentRequest();
	const previous = request ? request['tenantSettings'] : undefined;
	if (request && tenantSettings) {
		request['tenantSettings'] = tenantSettings;
	}
	try {
		for (const { provider, key } of unique(files)) {
			try {
				// `deleteFileOrFail`: `deleteFile` resolves without deleting when a provider has no client or a key
				// resolves outside the local root, and such a file would be reported as removed while it stays stored.
				await new FileStorage().getProvider(provider || undefined).deleteFileOrFail(key);
			} catch {
				failed++;
			}
		}
	} finally {
		if (request) {
			request['tenantSettings'] = previous;
		}
	}
	return { deleted: unique(files).length - failed, failed };
}

/**
 * A tenant's own settings (name → value), for {@link deleteStoredFiles}, soft-deleted ones excluded (as the
 * settings middleware reads them). Read before the tenant is deleted.
 */
export async function loadTenantSettings(manager: EntityManager, tenantId: ID): Promise<Record<string, unknown>> {
	const driver = manager.connection.driver;
	const rows: Array<{ name: string; value: string }> = await manager.query(
		`SELECT ${driver.escape('name')} AS ${driver.escape('name')}, ${driver.escape('value')} AS ${driver.escape(
			'value'
		)} FROM ${driver.escape('tenant_setting')} WHERE ${driver.escape('tenantId')} = ${sqlPlaceholder(
			manager,
			1
		)} AND ${driver.escape('deletedAt')} IS NULL`,
		[tenantId]
	);
	return Object.fromEntries(rows.map((row) => [row.name, row.value]));
}

function scopeCondition(
	manager: EntityManager,
	owner: FileOwningTable,
	scope: StoredFileScope,
	has: (column: string) => boolean
): { sql: string; parameters: unknown[] } | null {
	const driver = manager.connection.driver;
	const p = (n: number) => sqlPlaceholder(manager, n);

	if (scope.kind === 'workspace') {
		return has('tenantId') ? { sql: `${driver.escape('tenantId')} = ${p(1)}`, parameters: [scope.tenantId] } : null;
	}
	if (scope.kind === 'reset' || scope.kind === 'organizations') {
		if (!has('tenantId') || !has('organizationId') || !scope.organizationIds.length) return null;
		const list = scope.organizationIds.map((_, index) => p(index + 2)).join(', ');
		// A reset deletes the organizations' screenshots itself, every one of them; the other captures (camshots,
		// soundshots, videos) only go through the cascade from the time slots it deletes, so one without a time
		// slot stays, and so must its file.
		const attached =
			scope.kind === 'reset' && owner.timeSlot && owner.table !== 'screenshot' && has('timeSlotId')
				? ` AND ${driver.escape('timeSlotId')} IS NOT NULL`
				: '';
		return {
			sql: `${driver.escape('tenantId')} = ${p(1)} AND ${driver.escape('organizationId')} IN (${list})${attached}`,
			parameters: [scope.tenantId, ...scope.organizationIds]
		};
	}

	const conditions: string[] = [];
	const parameters: unknown[] = [];
	for (const column of owner.ownedBy.filter(has)) {
		parameters.push(scope.userId);
		conditions.push(`${driver.escape(column)} = ${p(parameters.length)}`);
	}
	for (const column of owner.ownedByEmployee.filter(has)) {
		parameters.push(scope.userId);
		conditions.push(
			`${driver.escape(column)} IN (SELECT e.${driver.escape('id')} FROM ${driver.escape('employee')} e WHERE e.${driver.escape(
				'userId'
			)} = ${p(parameters.length)})`
		);
	}
	if (owner.timeSlot && has('timeSlotId')) {
		// Captures are created against a time slot, often without `userId`: find them through the user's members.
		parameters.push(scope.userId);
		conditions.push(
			`${driver.escape('timeSlotId')} IN (SELECT ts.${driver.escape('id')} FROM ${driver.escape(
				'time_slot'
			)} ts JOIN ${driver.escape('employee')} e ON e.${driver.escape('id')} = ts.${driver.escape(
				'employeeId'
			)} WHERE e.${driver.escape('userId')} = ${p(parameters.length)})`
		);
	}
	return conditions.length ? { sql: conditions.join(' OR '), parameters } : null;
}

/**
 * Drops keys that an `image_asset` row outside the scope still uses: seeded avatars, for one, are separate
 * rows over the same file. Other tables' keys are unique per upload.
 */
async function withoutSharedKeys(
	manager: EntityManager,
	files: StoredFile[],
	scope: StoredFileScope
): Promise<StoredFile[]> {
	const images = files.filter((file) => file.table === 'image_asset');
	if (!images.length) return files;

	const driver = manager.connection.driver;
	const p = (n: number) => sqlPlaceholder(manager, n);
	const shared = new Set<string>();
	for (const { key } of unique(images)) {
		const parameters: unknown[] = [key, key];
		let outside = ''; // A user's avatar is checked separately (isImageAssetShared); here any other row counts.
		if (scope.kind !== 'user') {
			parameters.push(scope.tenantId);
			outside = ` AND (${driver.escape('tenantId')} IS NULL OR ${driver.escape('tenantId')} <> ${p(3)}`;
			if (scope.kind === 'reset' || scope.kind === 'organizations') {
				// Deleting some organizations: a row of another organization of the tenant, or a tenant-wide one
				// (no organization), still uses the file too.
				const list = scope.organizationIds.map((_, index) => p(index + 4)).join(', ');
				parameters.push(...scope.organizationIds);
				outside += ` OR ${driver.escape('organizationId')} IS NULL OR ${driver.escape('organizationId')} NOT IN (${list})`;
			}
			outside += ')';
		}
		const rows = await manager.query(
			`SELECT 1 FROM ${driver.escape('image_asset')} WHERE (${driver.escape('url')} = ${p(1)} OR ${driver.escape(
				'thumb'
			)} = ${p(2)})${outside}`,
			parameters
		);
		if (rows.length > (scope.kind === 'user' ? 1 : 0)) shared.add(key);
	}
	return files.filter((file) => file.table !== 'image_asset' || !shared.has(file.key));
}

/**
 * Whether anything besides the user (and their own member records) still uses an image: another user, an
 * organization logo, a project… Then neither the row nor its file may go with the user.
 */
export async function isImageAssetShared(manager: EntityManager, imageId: ID, userId: ID): Promise<boolean> {
	const driver = manager.connection.driver;
	const p = (n: number) => sqlPlaceholder(manager, n);
	for (const metadata of manager.connection.entityMetadatas) {
		if (metadata.tableType === 'view') continue;
		for (const foreignKey of metadata.foreignKeys) {
			if (foreignKey.referencedTablePath !== 'image_asset' || foreignKey.columnNames.length !== 1) continue;
			const column = driver.escape(foreignKey.columnNames[0]);
			const own =
				metadata.tablePath === 'user'
					? ` AND ${driver.escape('id')} <> ${p(2)}`
					: metadata.tablePath === 'employee'
						? ` AND (${driver.escape('userId')} IS NULL OR ${driver.escape('userId')} <> ${p(2)})`
						: '';
			const parameters = own ? [imageId, userId] : [imageId];
			const rows = await queryUnlessSchemaLacks(
				manager,
				`SELECT 1 FROM ${driver.escape(metadata.tablePath)} WHERE ${column} = ${p(1)}${own}`,
				parameters,
				{
					table: metadata.tablePath,
					columns: [foreignKey.columnNames[0], ...(metadata.tablePath === 'employee' ? ['userId'] : [])]
				}
			);
			if (rows?.length) return true;
		}
	}
	return false;
}

/**
 * Deletes the rows of `table` among `ids` that no other row references any more (checked through every
 * foreign key that points at `table`). For the separate rows a deleted member leaves behind, such as its
 * contact (address, fiscal details), which a shared organization may also use.
 *
 * @returns How many rows were deleted.
 */
export async function deleteUnusedRows(manager: EntityManager, table: string, ids: ID[]): Promise<number> {
	const driver = manager.connection.driver;
	const p = (n: number) => sqlPlaceholder(manager, n);
	const references = manager.connection.entityMetadatas.flatMap((metadata) =>
		metadata.tableType === 'view'
			? []
			: metadata.foreignKeys
					.filter(
						(foreignKey) => foreignKey.referencedTablePath === table && foreignKey.columnNames.length === 1
					)
					.map((foreignKey) => ({ table: metadata.tablePath, column: foreignKey.columnNames[0] }))
	);
	let deleted = 0;
	for (const id of ids) {
		let used = false;
		for (const reference of references) {
			const rows = await queryUnlessSchemaLacks(
				manager,
				`SELECT 1 FROM ${driver.escape(reference.table)} WHERE ${driver.escape(reference.column)} = ${p(1)}`,
				[id],
				{ table: reference.table, columns: [reference.column] }
			);
			if (rows?.length) {
				used = true;
				break;
			}
		}
		if (!used) {
			await manager.query(`DELETE FROM ${driver.escape(table)} WHERE ${driver.escape('id')} = ${p(1)}`, [id]);
			deleted++;
		}
	}
	return deleted;
}

function unique(files: StoredFile[]): StoredFile[] {
	const seen = new Set<string>();
	return files.filter((file) => {
		const id = `${file.provider || ''}|${file.key}`;
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}

/**
 * The tables of the rows a workspace keeps addressed to a person by their email: invitations (`invite`) and the
 * history of the emails sent (`email_sent`, the `EmailHistory` entity).
 */
export const ADDRESSED_ROW_TABLES: ReadonlyArray<string> = ['invite', 'email_sent'];

/**
 * Deletes the rows of a workspace that are addressed to the deleted person: the invitations sent to their address
 * and the history of the emails sent to it ({@link ADDRESSED_ROW_TABLES}). Deleting the account removed the user, but
 * these rows kept the address in the workspace the person left (a deleted whole workspace takes them with it).
 *
 * Matched on the address case-insensitively, in the account's own workspace only: another workspace that invited or
 * emailed the same address keeps its own rows. A table or column the deployment's schema lacks is skipped.
 *
 * @param manager The transaction's entity manager.
 * @param tenantId The account's workspace.
 * @param email The account's address.
 */
export async function deleteRowsAddressedTo(manager: EntityManager, tenantId: ID, email: string): Promise<void> {
	const address = (email || '').trim().toLowerCase();
	if (!tenantId || !address) {
		return;
	}
	const driver = manager.connection.driver;
	const p = (n: number) => sqlPlaceholder(manager, n);
	// SQL LOWER folds non-ASCII letters (`É@…`) on some databases only: not on SQLite, nor on Postgres under the C
	// collation. An address with such letters is therefore matched here, the way the address itself was lowercased.
	const matchInCode = /[^\x00-\x7f]/.test(address);
	for (const table of ADDRESSED_ROW_TABLES) {
		const target = { table, columns: ['id', 'tenantId', 'email'] };
		if (!matchInCode) {
			await queryUnlessSchemaLacks(
				manager,
				`DELETE FROM ${driver.escape(table)} WHERE ${driver.escape('tenantId')} = ${p(1)} AND LOWER(TRIM(${driver.escape('email')})) = ${p(2)}`,
				[tenantId, address],
				target
			);
			continue;
		}
		const rows: Array<{ id: ID; email: string | null }> | null = await queryUnlessSchemaLacks(
			manager,
			`SELECT ${driver.escape('id')}, ${driver.escape('email')} FROM ${driver.escape(table)} WHERE ${driver.escape('tenantId')} = ${p(1)}`,
			[tenantId],
			target
		);
		const ids = (rows ?? [])
			.filter((row) => (row.email || '').trim().toLowerCase() === address)
			.map((row) => row.id);
		for (let offset = 0; offset < ids.length; offset += 500) {
			const chunk = ids.slice(offset, offset + 500);
			await manager.query(
				`DELETE FROM ${driver.escape(table)} WHERE ${driver.escape('id')} IN (${chunk.map((_, i) => p(i + 1)).join(', ')})`,
				chunk
			);
		}
	}
}
