import { EntityManager } from 'typeorm';
import { FileStorageProvider, ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { FileStorage } from '../core/file-storage';
import { sqlPlaceholder } from '../user/user-authorship';

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
	/** Rows tied to a time slot: the user's captures are also found through their members' time slots. */
	timeSlot: boolean;
	/** Whether a factory reset ("Delete all data") deletes these rows (time-tracking captures). */
	reset: boolean;
}

export const FILE_OWNING_TABLES: ReadonlyArray<FileOwningTable> = [
	{ table: 'screenshot', keys: ['file', 'thumb'], ownedBy: ['userId'], timeSlot: true, reset: true },
	{ table: 'camshots', keys: ['fileKey', 'thumbKey'], ownedBy: ['userId'], timeSlot: true, reset: true },
	{ table: 'soundshots', keys: ['fileKey'], ownedBy: ['userId'], timeSlot: true, reset: true },
	{ table: 'video', keys: ['file'], ownedBy: [], timeSlot: true, reset: true },
	{ table: 'document', keys: ['storageKey', 'thumbKey'], ownedBy: [], timeSlot: false, reset: false },
	{ table: 'inbox_email_attachment', keys: ['storageKey'], ownedBy: [], timeSlot: false, reset: false },
	{ table: 'image_asset', keys: ['url', 'thumb'], ownedBy: [], timeSlot: false, reset: false }
];

/** A file in storage that goes with a deleted row. */
export interface StoredFile {
	table: string;
	provider?: FileStorageProvider | null;
	key: string;
}

/** Whose files: a whole workspace, one user's own (in a workspace that stays), or a reset's organizations. */
export type StoredFileScope =
	| { kind: 'workspace'; tenantId: ID }
	| { kind: 'user'; userId: ID }
	| { kind: 'reset'; tenantId: ID; organizationIds: ID[] };

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
		if (scope.kind === 'user' && !owner.ownedBy.length && !owner.timeSlot) continue;

		const metadata = manager.connection.entityMetadatas.find((candidate) => candidate.tablePath === owner.table);
		if (!metadata) continue;
		const has = (column: string) => metadata.columns.some((candidate) => candidate.databaseName === column);
		const keys = owner.keys.filter(has);
		if (!keys.length) continue;

		const where = scopeCondition(manager, owner, scope, has);
		if (!where) continue;

		const select = [...keys.map((key) => driver.escape(key)), has('storageProvider') ? driver.escape('storageProvider') : 'NULL'];
		const rows: Array<Record<string, string>> = await manager.query(
			`SELECT ${select.map((column, index) => `${column} AS ${driver.escape(`c${index}`)}`).join(', ')} FROM ${driver.escape(
				owner.table
			)} WHERE ${where.sql}`,
			where.parameters
		);
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
				await new FileStorage().getProvider(provider || undefined).deleteFile(key);
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
	if (scope.kind === 'reset') {
		if (!has('tenantId') || !has('organizationId') || !scope.organizationIds.length) return null;
		const list = scope.organizationIds.map((_, index) => p(index + 2)).join(', ');
		return {
			sql: `${driver.escape('tenantId')} = ${p(1)} AND ${driver.escape('organizationId')} IN (${list})`,
			parameters: [scope.tenantId, ...scope.organizationIds]
		};
	}

	const conditions: string[] = [];
	const parameters: unknown[] = [];
	for (const column of owner.ownedBy.filter(has)) {
		parameters.push(scope.userId);
		conditions.push(`${driver.escape(column)} = ${p(parameters.length)}`);
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
async function withoutSharedKeys(manager: EntityManager, files: StoredFile[], scope: StoredFileScope): Promise<StoredFile[]> {
	const images = files.filter((file) => file.table === 'image_asset');
	if (!images.length) return files;

	const driver = manager.connection.driver;
	const p = (n: number) => sqlPlaceholder(manager, n);
	const shared = new Set<string>();
	for (const { key } of unique(images)) {
		const outside =
			scope.kind === 'user'
				? '' // A user's avatar is checked separately (isImageAssetShared); here any other row counts.
				: ` AND (${driver.escape('tenantId')} IS NULL OR ${driver.escape('tenantId')} <> ${p(3)})`;
		const parameters: unknown[] = [key, key];
		if (scope.kind !== 'user') parameters.push(scope.tenantId);
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
			const rows = await manager.query(
				`SELECT 1 FROM ${driver.escape(metadata.tablePath)} WHERE ${column} = ${p(1)}${own}`,
				parameters
			);
			if (rows.length) return true;
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
					.filter((foreignKey) => foreignKey.referencedTablePath === table && foreignKey.columnNames.length === 1)
					.map((foreignKey) => ({ table: metadata.tablePath, column: foreignKey.columnNames[0] }))
	);
	let deleted = 0;
	for (const id of ids) {
		let used = false;
		for (const reference of references) {
			const rows = await manager.query(
				`SELECT 1 FROM ${driver.escape(reference.table)} WHERE ${driver.escape(reference.column)} = ${p(1)}`,
				[id]
			);
			if (rows.length) {
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
