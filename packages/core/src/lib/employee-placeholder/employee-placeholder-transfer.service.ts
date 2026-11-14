import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, QueryRunner } from 'typeorm';
import {
	ID,
	IEmployeePlaceholderMergePreview,
	IEmployeePlaceholderTransferSummary,
	InviteStatusEnum
} from '@gauzy/contracts';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { EmployeeReference, UniqueKey, bareTableName, readEmployeeReferences } from './employee-references';

/** Named parameters of a statement, written `:name` in its SQL. */
type Parameters = Record<string, unknown>;

/**
 * The rates of a member that move with a member without an account, each pair as one: a member keeps every rate they
 * already have, and only an empty one takes the placeholder's.
 */
const RATE_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
	['billRateValue', 'billRateCurrency'],
	['minimumBillingRate'],
	['payRateValue', 'payRateCurrency'],
	['payPeriod']
];

/** What a transfer reads of each of its two members. */
interface TransferMember {
	id: ID;
	organizationId: ID;
	userId: ID;
	isPlaceholder: boolean;
}

/** The two members of a transfer, read (and locked, inside a transaction) before anything moves. */
interface TransferPair {
	placeholder: TransferMember;
	target: TransferMember;
}

/**
 * Moves what belongs to a member without an account (a placeholder) to a member with one, when the person claims it
 * or an admin merges it, then removes the placeholder and retires its user. Everything happens in one transaction.
 *
 * What points at the placeholder is read from the database's own foreign keys, not from a list kept here: time logs,
 * time slots, timesheets, activities, task assignments, team, project and contact memberships, invoice lines,
 * expenses, and every table a plugin adds. A row that would collide on a unique key with a row the member already has
 * (a team both belong to, a task both are assigned) is the placeholder's duplicate and goes; every other row moves.
 * Nothing is left pointing at the removed placeholder.
 *
 * It runs on the TypeORM connection under either ORM setting, as the agent employee provisioning does.
 */
@Injectable()
export class EmployeePlaceholderTransferService {
	constructor(private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository) {}

	/**
	 * What merging a member without an account into a member would move, and how many of its entries overlap the
	 * member's own. Writes nothing.
	 *
	 * @param placeholderId The member without an account.
	 * @param targetId The member with an account it would be merged into.
	 * @param tenantId The tenant of the request.
	 */
	async preview(placeholderId: ID, targetId: ID, tenantId: ID): Promise<IEmployeePlaceholderMergePreview> {
		const queryRunner = this.typeOrmEmployeeRepository.manager.connection.createQueryRunner();
		try {
			const { placeholder, target } = await readPair(queryRunner, placeholderId, targetId, tenantId, false);
			const summary = await summarize(queryRunner, placeholder.id);
			const overlappingTimeLogs = await countOverlappingTimeLogs(queryRunner, placeholder.id, target.id);
			return {
				placeholderEmployeeId: placeholder.id,
				targetEmployeeId: target.id,
				...summary,
				overlappingTimeLogs
			};
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Moves everything of a member without an account to a member of the same organization who has an account, then
	 * removes the placeholder and retires its user, in one transaction.
	 *
	 * @param placeholderId The member without an account.
	 * @param targetId The member with an account who takes it all.
	 * @param tenantId The tenant of the request (or of the invitation being accepted).
	 * @param options `keepInviteId`: the claim invitation being accepted, which is kept; other pending claims of the
	 * placeholder are removed.
	 * @returns What moved.
	 */
	async transfer(
		placeholderId: ID,
		targetId: ID,
		tenantId: ID,
		options: { keepInviteId?: ID } = {}
	): Promise<IEmployeePlaceholderTransferSummary> {
		const references = await this.readReferences();
		return await this.typeOrmEmployeeRepository.manager.transaction(async (manager: EntityManager) => {
			return await this.transferWithin(manager, references, placeholderId, targetId, tenantId, options);
		});
	}

	/**
	 * The columns pointing at an employee, read from the database's catalog on a connection of their own, before the
	 * transfer's transaction, which then holds its locks only for the writes.
	 */
	private async readReferences(): Promise<EmployeeReference[]> {
		const queryRunner = this.typeOrmEmployeeRepository.manager.connection.createQueryRunner();
		try {
			return await readEmployeeReferences(queryRunner);
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * The transfer, inside the caller's transaction.
	 */
	private async transferWithin(
		manager: EntityManager,
		references: EmployeeReference[],
		placeholderId: ID,
		targetId: ID,
		tenantId: ID,
		options: { keepInviteId?: ID }
	): Promise<IEmployeePlaceholderTransferSummary> {
		const queryRunner = manager.queryRunner;
		const { placeholder, target } = await readPair(queryRunner, placeholderId, targetId, tenantId, true);

		const summary = await summarize(queryRunner, placeholder.id);
		await fillMissingRates(queryRunner, placeholder.id, target.id);

		for (const reference of references) {
			await moveReference(queryRunner, reference, placeholder.id, target.id);
		}

		await removePendingClaims(queryRunner, placeholder.id, options.keepInviteId);
		await run(queryRunner, `DELETE FROM ${name(queryRunner, 'employee')} WHERE ${name(queryRunner, 'id')} = :id`, {
			id: placeholder.id
		});
		await retireUserIfUnused(queryRunner, placeholder.userId);

		return summary;
	}
}

/**
 * Reads the two members of a transfer and checks they can be one: a member without an account and a member with one,
 * of the same organization of the request's tenant. Inside a transaction, both rows are locked first.
 */
async function readPair(
	queryRunner: QueryRunner,
	placeholderId: ID,
	targetId: ID,
	tenantId: ID,
	lock: boolean
): Promise<TransferPair> {
	if (placeholderId === targetId) {
		throw new BadRequestException('A member without an account cannot be merged into itself.');
	}
	// The placeholder is locked FOR UPDATE: it is deleted at the end, and a concurrent insert that references it must
	// wait and then fail rather than leave a row pointing at a removed member.
	const placeholder = await readEmployee(queryRunner, placeholderId, tenantId, lock ? 'update' : false);
	if (!placeholder) {
		throw new NotFoundException('The member without an account does not exist.');
	}
	if (!placeholder.isPlaceholder) {
		throw new BadRequestException('This member has an account: only a member without one is claimed or merged.');
	}
	// The target is locked FOR NO KEY UPDATE on Postgres: it serializes two transfers into the member without blocking
	// the foreign-key checks of the member's own time logs, slots and screenshots written while this one runs.
	const target = await readEmployee(queryRunner, targetId, tenantId, lock ? 'no-key' : false);
	if (!target) {
		throw new NotFoundException('The member to merge into does not exist.');
	}
	if (target.isPlaceholder) {
		throw new BadRequestException('A member without an account can only be merged into a member with one.');
	}
	const sameOrganization = target.organizationId === placeholder.organizationId;
	if (!sameOrganization) {
		throw new ConflictException('Both members must belong to the same organization.');
	}
	return { placeholder, target };
}

/**
 * One employee of the tenant, not deleted. Inside a transaction on Postgres and MySQL the row is locked for the rest of
 * it, so that a claim and a merge of the same placeholder run one after the other; SQLite allows one writer at a time.
 * `update` takes `FOR UPDATE`; `no-key` takes `FOR NO KEY UPDATE` on Postgres (it does not block foreign-key checks
 * against the row) and `FOR UPDATE` on MySQL, which has no weaker row lock.
 */
async function readEmployee(
	queryRunner: QueryRunner,
	id: ID,
	tenantId: ID,
	lock: false | 'update' | 'no-key'
): Promise<TransferMember | null> {
	const type = queryRunner.connection.options.type;
	const locks = lock !== false && (type === 'postgres' || type === 'mysql' || type === 'mariadb');
	let forUpdate = '';
	if (locks) {
		forUpdate = type === 'postgres' && lock === 'no-key' ? ' FOR NO KEY UPDATE' : ' FOR UPDATE';
	}
	const [row] = (await select(
		queryRunner,
		`SELECT ${['id', 'organizationId', 'userId', 'isPlaceholder']
			.map((column) => `${name(queryRunner, column)} AS ${name(queryRunner, column)}`)
			.join(', ')} FROM ${name(queryRunner, 'employee')} WHERE ${name(queryRunner, 'id')} = :id AND ${name(
			queryRunner,
			'tenantId'
		)} = :tenant AND ${name(queryRunner, 'deletedAt')} IS NULL${forUpdate}`,
		{ id, tenant: tenantId }
	)) as Array<Record<string, unknown>>;
	if (!row) {
		return null;
	}
	return {
		id: String(row.id),
		organizationId: String(row.organizationId),
		userId: String(row.userId),
		isPlaceholder: isTrue(row.isPlaceholder)
	};
}

/** A stored boolean as each database returns it: true, 1 or '1' (MySQL, SQLite), 't' (raw Postgres). */
function isTrue(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 't';
}

/** What a transfer of the placeholder moves: its entries and their duration, timesheets, assignments and teams. */
async function summarize(queryRunner: QueryRunner, placeholderId: ID): Promise<IEmployeePlaceholderTransferSummary> {
	const entries = (await select(
		queryRunner,
		`SELECT ${name(queryRunner, 'startedAt')} AS ${name(queryRunner, 'startedAt')}, ${name(
			queryRunner,
			'stoppedAt'
		)} AS ${name(queryRunner, 'stoppedAt')} FROM ${name(queryRunner, 'time_log')} WHERE ${name(
			queryRunner,
			'employeeId'
		)} = :employee AND ${name(queryRunner, 'deletedAt')} IS NULL`,
		{ employee: placeholderId }
	)) as Array<{ startedAt: unknown; stoppedAt: unknown }>;
	const duration = entries.reduce((total, entry) => total + secondsBetween(entry.startedAt, entry.stoppedAt), 0);

	const timesheets = await count(queryRunner, 'timesheet', placeholderId, true);
	const taskAssignments = await count(queryRunner, 'task_employee', placeholderId, false);
	const teams = (await select(
		queryRunner,
		`SELECT ot.${name(queryRunner, 'id')} AS ${name(queryRunner, 'id')}, ot.${name(
			queryRunner,
			'name'
		)} AS ${name(queryRunner, 'name')} FROM ${name(queryRunner, 'organization_team_employee')} ote INNER JOIN ${name(
			queryRunner,
			'organization_team'
		)} ot ON ot.${name(queryRunner, 'id')} = ote.${name(
			queryRunner,
			'organizationTeamId'
		)} WHERE ote.${name(queryRunner, 'employeeId')} = :employee ORDER BY ot.${name(queryRunner, 'name')}`,
		{ employee: placeholderId }
	)) as Array<{ id: ID; name: string }>;

	return {
		timeLogs: entries.length,
		duration,
		timesheets,
		taskAssignments,
		teams: teams.map((team) => ({ id: team.id, name: team.name }))
	};
}

/** Entries of the placeholder that overlap an entry of the member it would be merged into. */
async function countOverlappingTimeLogs(queryRunner: QueryRunner, placeholderId: ID, targetId: ID): Promise<number> {
	const startedAt = name(queryRunner, 'startedAt');
	const stoppedAt = name(queryRunner, 'stoppedAt');
	const employeeId = name(queryRunner, 'employeeId');
	const deletedAt = name(queryRunner, 'deletedAt');
	const timeLog = name(queryRunner, 'time_log');
	const [row] = (await select(
		queryRunner,
		`SELECT COUNT(*) AS ${name(queryRunner, 'total')} FROM ${timeLog} entry WHERE entry.${employeeId} = :placeholder ` +
			`AND entry.${deletedAt} IS NULL AND EXISTS (SELECT 1 FROM ${timeLog} other WHERE other.${employeeId} = :target ` +
			`AND other.${deletedAt} IS NULL AND other.${startedAt} < entry.${stoppedAt} AND other.${stoppedAt} > entry.${startedAt})`,
		{ placeholder: placeholderId, target: targetId }
	)) as Array<{ total: unknown }>;
	return Number(row?.total ?? 0);
}

/** Copies each rate the member does not have from the placeholder, a value with its currency. */
async function fillMissingRates(queryRunner: QueryRunner, placeholderId: ID, targetId: ID): Promise<void> {
	const columns = RATE_GROUPS.flat();
	const rows = (await select(
		queryRunner,
		`SELECT ${name(queryRunner, 'id')} AS ${name(queryRunner, 'id')}, ${columns
			.map((column) => `${name(queryRunner, column)} AS ${name(queryRunner, column)}`)
			.join(
				', '
			)} FROM ${name(queryRunner, 'employee')} WHERE ${name(queryRunner, 'id')} IN (:placeholder, :target)`,
		{ placeholder: placeholderId, target: targetId }
	)) as Array<Record<string, unknown>>;
	const placeholder = rows.find((row) => row.id === placeholderId);
	const target = rows.find((row) => row.id === targetId);
	if (!placeholder || !target) {
		return;
	}

	const changes: Parameters = {};
	for (const group of RATE_GROUPS) {
		const leading = group[0];
		const placeholderHasIt = isSet(placeholder[leading]);
		const targetLacksIt = !isSet(target[leading]);
		if (placeholderHasIt && targetLacksIt) {
			for (const column of group) {
				changes[column] = placeholder[column];
			}
		}
	}
	const assignments = Object.keys(changes);
	if (assignments.length === 0) {
		return;
	}
	await run(
		queryRunner,
		`UPDATE ${name(queryRunner, 'employee')} SET ${assignments
			.map((column) => `${name(queryRunner, column)} = :${column}`)
			.join(', ')} WHERE ${name(queryRunner, 'id')} = :target`,
		{ ...changes, target: targetId }
	);
}

/**
 * Moves one reference from the placeholder to the member: first removes the placeholder's rows that would collide
 * with a row the member already has on a unique key of the table, then points the others at the member.
 */
async function moveReference(
	queryRunner: QueryRunner,
	reference: EmployeeReference,
	placeholderId: ID,
	targetId: ID
): Promise<void> {
	for (const key of reference.uniqueKeys) {
		await removeCollisions(queryRunner, reference, key, placeholderId, targetId);
	}
	const table = tableName(queryRunner, reference.table);
	const column = name(queryRunner, reference.column);
	await run(queryRunner, `UPDATE ${table} SET ${column} = :target WHERE ${column} = :placeholder`, {
		target: targetId,
		placeholder: placeholderId
	});
}

/**
 * Removes the placeholder's rows that hold the same values as a row of the member on every other column of a unique
 * key (with the key's condition when the index is partial): moving them would break the key, and the member's row
 * already says the same thing. Values compared with `=`, so a NULL never collides, as in the databases' unique keys.
 */
async function removeCollisions(
	queryRunner: QueryRunner,
	reference: EmployeeReference,
	key: UniqueKey,
	placeholderId: ID,
	targetId: ID
): Promise<void> {
	const table = tableName(queryRunner, reference.table);
	const column = name(queryRunner, reference.column);
	const others = key.columns.filter((it) => it !== reference.column);
	let condition = '';
	if (key.where) {
		condition = ` AND (${key.where})`;
	}
	const sameValues = others
		.map((it) => ` AND other.${name(queryRunner, it)} = entry.${name(queryRunner, it)}`)
		.join('');
	const selected = others.map((it) => `entry.${name(queryRunner, it)} AS ${name(queryRunner, it)}`);
	const selectList = selected.length > 0 ? selected.join(', ') : `1 AS ${name(queryRunner, 'found')}`;

	const collisions = (await select(
		queryRunner,
		`SELECT ${selectList} FROM ${table} entry WHERE entry.${column} = :placeholder${condition} ` +
			`AND EXISTS (SELECT 1 FROM ${table} other WHERE other.${column} = :target${sameValues}${condition})`,
		{ placeholder: placeholderId, target: targetId }
	)) as Array<Record<string, unknown>>;

	for (const collision of collisions) {
		const parameters: Parameters = { placeholder: placeholderId };
		const sameRow = others
			.map((it, position) => {
				parameters[`k${position}`] = collision[it];
				return ` AND ${name(queryRunner, it)} = :k${position}`;
			})
			.join('');
		await run(queryRunner, `DELETE FROM ${table} WHERE ${column} = :placeholder${sameRow}${condition}`, parameters);
	}
}

/** Removes the pending claim invitations of the placeholder, except the one being accepted. */
async function removePendingClaims(queryRunner: QueryRunner, placeholderId: ID, keepInviteId?: ID): Promise<void> {
	const parameters: Parameters = { placeholder: placeholderId, invited: InviteStatusEnum.INVITED };
	let keep = '';
	if (keepInviteId) {
		keep = ` AND ${name(queryRunner, 'id')} <> :keep`;
		parameters.keep = keepInviteId;
	}
	await run(
		queryRunner,
		`DELETE FROM ${name(queryRunner, 'invite')} WHERE ${name(queryRunner, 'placeholderEmployeeId')} = :placeholder ` +
			`AND ${name(queryRunner, 'status')} = :invited${keep}`,
		parameters
	);
}

/**
 * Retires the placeholder's user, created for it alone, unless another employee still stands on it: deactivated,
 * archived and soft-deleted. Not deleted: deleting a user makes the database check every table naming a user (who
 * created, changed or deleted each row), which takes minutes on a large database. With no email and no password, it
 * never signed in and never can.
 */
async function retireUserIfUnused(queryRunner: QueryRunner, userId: ID | undefined): Promise<void> {
	if (!userId) {
		return;
	}
	const [row] = (await select(
		queryRunner,
		`SELECT COUNT(*) AS ${name(queryRunner, 'total')} FROM ${name(queryRunner, 'employee')} WHERE ${name(
			queryRunner,
			'userId'
		)} = :user`,
		{ user: userId }
	)) as Array<{ total: unknown }>;
	const stillUsed = Number(row?.total ?? 0) > 0;
	if (stillUsed) {
		return;
	}
	await run(
		queryRunner,
		`UPDATE ${name(queryRunner, 'user')} SET ${name(queryRunner, 'isActive')} = :active, ${name(
			queryRunner,
			'isArchived'
		)} = :archived, ${name(queryRunner, 'deletedAt')} = :now WHERE ${name(queryRunner, 'id')} = :user`,
		{ active: false, archived: true, now: new Date(), user: userId }
	);
}

/** Rows of a table pointing at the employee, not deleted when the table keeps deleted rows. */
async function count(queryRunner: QueryRunner, table: string, employeeId: ID, softDeleted: boolean): Promise<number> {
	let notDeleted = '';
	if (softDeleted) {
		notDeleted = ` AND ${name(queryRunner, 'deletedAt')} IS NULL`;
	}
	const [row] = (await select(
		queryRunner,
		`SELECT COUNT(*) AS ${name(queryRunner, 'total')} FROM ${name(queryRunner, table)} WHERE ${name(
			queryRunner,
			'employeeId'
		)} = :employee${notDeleted}`,
		{ employee: employeeId }
	)) as Array<{ total: unknown }>;
	return Number(row?.total ?? 0);
}

/** Seconds between two stored dates, nothing for an entry without its end. */
function secondsBetween(start: unknown, end: unknown): number {
	if (!start || !end) {
		return 0;
	}
	const milliseconds = toDate(end).getTime() - toDate(start).getTime();
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
		return 0;
	}
	return Math.floor(milliseconds / 1000);
}

/** A date as the driver returns it: a Date, or a string (SQLite stores UTC text without a zone). */
function toDate(value: unknown): Date {
	if (value instanceof Date) {
		return value;
	}
	const text = String(value);
	const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text);
	if (hasZone) {
		return new Date(text);
	}
	return new Date(`${text.replace(' ', 'T')}Z`);
}

/** Whether a stored value is there: not null, not undefined. */
function isSet(value: unknown): boolean {
	return value !== null && value !== undefined;
}

/** An identifier quoted for the connection's database. */
function name(queryRunner: QueryRunner, identifier: string): string {
	return queryRunner.connection.driver.escape(identifier);
}

/** A table name, with its schema when the database gives one, quoted for the connection's database. */
function tableName(queryRunner: QueryRunner, table: string): string {
	if (bareTableName(table) === table) {
		return name(queryRunner, table);
	}
	return table
		.split('.')
		.map((part) => name(queryRunner, part))
		.join('.');
}

/** Runs a statement with named parameters, translated to the database's own placeholders. */
async function run(queryRunner: QueryRunner, sql: string, parameters: Parameters): Promise<void> {
	const [query, values] = queryRunner.connection.driver.escapeQueryWithParameters(sql, parameters);
	await queryRunner.query(query, values);
}

/** Reads rows with named parameters, translated to the database's own placeholders. */
async function select(queryRunner: QueryRunner, sql: string, parameters: Parameters): Promise<unknown[]> {
	const [query, values] = queryRunner.connection.driver.escapeQueryWithParameters(sql, parameters);
	return (await queryRunner.query(query, values)) as unknown[];
}
