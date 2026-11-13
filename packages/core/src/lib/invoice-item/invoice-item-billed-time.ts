import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { EntityManager, In, ObjectLiteral, Repository } from 'typeorm';
import {
	EntityData,
	EntityManager as MikroOrmEntityManager,
	FilterQuery,
	LockMode,
	QueryOrder,
	raw
} from '@mikro-orm/core';
import { ID, IInvoiceItemCreateInput, InvoiceStatusTypesEnum, PermissionsEnum } from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { MultiORM, MultiORMEnum } from '../core/utils';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { TimeLog } from '../core/entities/internal';
import { prepareSQLQuery as p } from '../database/database.helper';

/** The refusal of a save that names a time log it may not bill. It does not say which one, nor whose it is. */
export const TIME_LOG_NOT_BILLABLE =
	"INVOICE_TIME_LOG_NOT_BILLABLE: a line names a time log it cannot bill (another organization's, another " +
	"employee's when you may bill only your own, a removed one, one named twice, or one an invoice that is not void " +
	'already bills). Nothing was saved: read the time not invoiced yet (notInvoiced=true) and save again.';

/** The values {@link notOnLiveInvoice} binds. */
export const NOT_ON_LIVE_INVOICE_PARAMETERS = { billedTimeVoidStatus: InvoiceStatusTypesEnum.VOID };

/** A time log's `invoiceItemId` as an update names it: by the table, which an update does not alias. */
const UPDATED_TIME_LOG_INVOICE_ITEM = '"time_log"."invoiceItemId"';

/**
 * The condition that a time log is on no live invoice: the line its `invoiceItemId` names, if any, is removed, or
 * belongs to no invoice any more (deleting an invoice sets its lines' `invoiceId` to null), or to an invoice that is
 * removed or void. The link itself is kept in all those cases, as the record of what the line billed.
 *
 * @param invoiceItemColumn The time log's `invoiceItemId`, qualified by the name the statement gives the table.
 * @returns The condition, quoted for the database in use, binding {@link NOT_ON_LIVE_INVOICE_PARAMETERS}.
 */
export function notOnLiveInvoice(invoiceItemColumn: string): string {
	return p(
		`NOT EXISTS (SELECT 1 FROM "invoice_item" "billing_line" ` +
			`INNER JOIN "invoice" "billing_invoice" ON "billing_invoice"."id" = "billing_line"."invoiceId" ` +
			`WHERE "billing_line"."id" = ${invoiceItemColumn} AND "billing_line"."deletedAt" IS NULL ` +
			`AND "billing_invoice"."deletedAt" IS NULL AND "billing_invoice"."status" <> :billedTimeVoidStatus)`
	);
}

/**
 * {@link notOnLiveInvoice} as a key of a MikroORM read's `where`, on the alias the read gives the time log. A raw key
 * is consumed by the statement that reads it: each read gets its own.
 */
export function mikroOrmNotOnLiveInvoiceKey(): string {
	return raw((alias: string) => notOnLiveInvoice(`${alias}."invoiceItemId"`), NOT_ON_LIVE_INVOICE_PARAMETERS);
}

/** A line of a save that bills time: where it stands among the lines saved, its organization, and its time logs. */
export interface IBillingLine {
	index: number;
	organizationId: ID;
	timeLogIds: ID[];
}

/** The lines of a save as they are written, and the ones among them that bill time. */
export interface ILinesBillingTime<L> {
	lines: L[];
	billing: IBillingLine[];
}

/** A saved line and the time logs it bills. */
interface IBilledLine {
	lineId: ID;
	organizationId: ID;
	timeLogIds: ID[];
}

/** Who bills the time: the caller's tenant and, unless the caller may act for other employees, their own employee. */
interface IBillingScope {
	tenantId: ID;
	employeeId?: ID;
}

/**
 * The lines of a save without their `timeLogIds`, which no table holds, and the time each line bills, each time log
 * once. A line that does not state `timeLogIds` is passed on as it is.
 *
 * @param lines The lines as the request states them.
 * @returns The lines to write, and the lines that bill time.
 * @throws BadRequestException when a line that bills time states no organization.
 */
export function splitBilledTime<L extends IInvoiceItemCreateInput>(lines: L[]): ILinesBillingTime<L> {
	const written: L[] = [];
	const billing: IBillingLine[] = [];
	for (const [index, line] of lines.entries()) {
		const lineWritten = withoutTimeLogIds(line);
		written.push(lineWritten);
		const timeLogIds = distinctTimeLogIdsOf(line);
		if (timeLogIds.length > 0) {
			const organizationId = organizationOf(line);
			billing.push({ index, organizationId, timeLogIds });
		}
	}
	return { lines: written, billing };
}

/**
 * Saves lines and writes, on each time log they bill, the line that bills it, in one transaction on the ORM the
 * installation runs: a time log that cannot be billed rolls the whole save back.
 *
 * On TypeORM, `save` is given a view of the service whose repository is the transaction's, so the tenant-aware writes
 * of the CRUD base, and their checks, run in the transaction (see `TaskService.inUpdateTransaction`). On MikroORM the
 * service's repositories follow the transaction on their own.
 *
 * @param service The service that saves the lines.
 * @param repositories The service's own repositories.
 * @param save The save, run on the service it is given.
 * @param savedLines The lines the save wrote, in the order of the request's lines.
 * @param billing The lines that bill time, as {@link splitBilledTime} found them.
 * @returns What the save answered.
 */
export async function saveBillingTime<S extends { ormType: MultiORM }, E extends ObjectLiteral, R>(
	service: S,
	repositories: { typeOrm: Repository<E>; mikroOrm: MikroOrmBaseEntityRepository<E> },
	save: (service: S) => Promise<R>,
	savedLines: (saved: R) => Array<{ id?: ID }>,
	billing: IBillingLine[]
): Promise<R> {
	const scope = billingScope();
	if (service.ormType === MultiORMEnum.MikroORM) {
		const entityManager = repositories.mikroOrm.getEntityManager();
		return await entityManager.transactional(async (em) => {
			const saved = await save(service);
			const lines = savedLines(saved);
			const billed = billedLinesOf(lines, billing);
			await mikroOrmBillTimeLogs(em, billed, scope);
			return saved;
		});
	}
	return await repositories.typeOrm.manager.transaction(async (manager) => {
		const repository = manager.getRepository(repositories.typeOrm.target);
		const inTransaction: S = Object.create(service, {
			typeOrmRepository: { value: repository, configurable: true }
		});
		const saved = await save(inTransaction);
		const lines = savedLines(saved);
		const billed = billedLinesOf(lines, billing);
		await typeOrmBillTimeLogs(manager, billed, scope);
		return saved;
	});
}

/**
 * Writes each line on the time logs it bills, on the transaction's TypeORM manager. The time logs are locked first, so
 * that two saves billing the same time log run one after the other, and each line's statement writes only the time
 * logs it may bill: when it writes fewer than it names, the save is refused.
 */
async function typeOrmBillTimeLogs(manager: EntityManager, lines: IBilledLine[], scope: IBillingScope): Promise<void> {
	const timeLogIds = timeLogIdsOf(lines);
	await typeOrmLockTimeLogs(manager, timeLogIds, scope.tenantId);
	const billedNowhereElse = notOnLiveInvoice(UPDATED_TIME_LOG_INVOICE_ITEM);
	// One line after the other: a line's statement must see what the lines before it billed (a time log named twice).
	for (const line of lines) {
		const query = manager
			.createQueryBuilder()
			.update(TimeLog)
			.set({ invoiceItemId: line.lineId })
			.where(p(`"id" IN (:...timeLogIds)`), { timeLogIds: line.timeLogIds })
			.andWhere(p(`"tenantId" = :tenantId`), { tenantId: scope.tenantId })
			.andWhere(p(`"organizationId" = :organizationId`), { organizationId: line.organizationId })
			.andWhere(p(`"deletedAt" IS NULL`))
			.andWhere(billedNowhereElse, NOT_ON_LIVE_INVOICE_PARAMETERS);
		if (scope.employeeId) {
			query.andWhere(p(`"employeeId" = :employeeId`), { employeeId: scope.employeeId });
		}
		const { affected } = await query.execute();
		assertEveryTimeLogBilled(affected, line);
	}
}

/** The MikroORM form of {@link typeOrmBillTimeLogs}, on the transaction's entity manager. */
async function mikroOrmBillTimeLogs(
	em: MikroOrmEntityManager,
	lines: IBilledLine[],
	scope: IBillingScope
): Promise<void> {
	const timeLogIds = timeLogIdsOf(lines);
	await mikroOrmLockTimeLogs(em, timeLogIds, scope.tenantId);
	const billedNowhereElse = notOnLiveInvoice(UPDATED_TIME_LOG_INVOICE_ITEM);
	const employeeCondition = mikroOrmEmployeeCondition(scope);
	for (const line of lines) {
		// A raw condition is a key MikroORM consumes once, so each statement gets its own.
		const billedNowhereElseKey = raw(billedNowhereElse, NOT_ON_LIVE_INVOICE_PARAMETERS);
		const where = {
			id: { $in: line.timeLogIds },
			tenantId: scope.tenantId,
			organizationId: line.organizationId,
			deletedAt: null,
			...employeeCondition,
			[billedNowhereElseKey]: []
		} as FilterQuery<TimeLog>;
		// `invoiceItemId` is the relation's `persist: false` mirror, so the relation is written; a native update does
		// not stamp the update date.
		const linked = { invoiceItem: line.lineId, updatedAt: new Date() } as EntityData<TimeLog>;
		const affected = await em.nativeUpdate(TimeLog, where, linked);
		assertEveryTimeLogBilled(affected, line);
	}
}

/**
 * Locks the time logs a save bills, in id order, until the transaction ends. The check each line's statement makes
 * reads other tables, and a row update re-checks only the row: a save that waited for another one to commit could
 * otherwise bill a time log the other has just billed. The embedded dialect runs one transaction at a time.
 */
async function typeOrmLockTimeLogs(manager: EntityManager, timeLogIds: ID[], tenantId: ID): Promise<void> {
	if (!locksRows()) {
		return;
	}
	await manager
		.createQueryBuilder(TimeLog, 'time_log')
		.select('time_log.id')
		.where({ id: In(timeLogIds), tenantId })
		.orderBy('time_log.id', 'ASC')
		.setLock('pessimistic_write')
		.getRawMany();
}

/** The MikroORM form of {@link typeOrmLockTimeLogs}. */
async function mikroOrmLockTimeLogs(em: MikroOrmEntityManager, timeLogIds: ID[], tenantId: ID): Promise<void> {
	if (!locksRows()) {
		return;
	}
	await em.find(
		TimeLog,
		{ id: { $in: timeLogIds }, tenantId },
		{ fields: ['id'], orderBy: { id: QueryOrder.ASC }, lockMode: LockMode.PESSIMISTIC_WRITE }
	);
}

/** Whether the database locks rows for a transaction: PostgreSQL and MySQL do, SQLite runs one writer at a time. */
function locksRows(): boolean {
	return isPostgres() || isMySQL();
}

/**
 * Who bills: the caller's tenant and, for a caller who may not act for other employees, their own employee, whose
 * time alone they may bill. A caller with neither may bill nothing.
 *
 * @throws BadRequestException when the caller has no tenant, or may only bill their own time and has no employee.
 */
function billingScope(): IBillingScope {
	const tenantId = RequestContext.currentTenantId();
	if (!tenantId) {
		throw new BadRequestException(TIME_LOG_NOT_BILLABLE);
	}
	if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
		return { tenantId };
	}
	const employeeId = RequestContext.currentEmployeeId();
	if (!employeeId) {
		throw new BadRequestException(TIME_LOG_NOT_BILLABLE);
	}
	return { tenantId, employeeId };
}

/** The employee condition of {@link billingScope}, through the relation MikroORM writes and filters. */
function mikroOrmEmployeeCondition(scope: IBillingScope): Record<string, ID> {
	if (!scope.employeeId) {
		return {};
	}
	return { employee: scope.employeeId };
}

/** Each billing line with the id the save gave it, read at its position among the lines saved. */
function billedLinesOf(saved: Array<{ id?: ID }>, billing: IBillingLine[]): IBilledLine[] {
	return billing.map((line) => billedLineOf(saved, line));
}

function billedLineOf(saved: Array<{ id?: ID }>, line: IBillingLine): IBilledLine {
	const lineId = savedLineId(saved, line.index);
	return { lineId, organizationId: line.organizationId, timeLogIds: line.timeLogIds };
}

/**
 * The id of the line saved at a position. A save answers its lines in the order of the request; a line it did not
 * answer is not billed against a guess, and the transaction rolls back.
 */
function savedLineId(saved: Array<{ id?: ID }>, index: number): ID {
	const id = saved?.[index]?.id;
	if (!id) {
		throw new InternalServerErrorException('INVOICE_LINE_NOT_SAVED: a line that bills time was not saved.');
	}
	return id;
}

function timeLogIdsOf(lines: IBilledLine[]): ID[] {
	return lines.flatMap((line) => line.timeLogIds);
}

function assertEveryTimeLogBilled(written: number | undefined, line: IBilledLine): void {
	const writtenCount = written ?? 0;
	if (writtenCount < line.timeLogIds.length) {
		throw new BadRequestException(TIME_LOG_NOT_BILLABLE);
	}
}

function distinctTimeLogIdsOf(line: IInvoiceItemCreateInput): ID[] {
	const named = line.timeLogIds ?? [];
	return [...new Set(named)];
}

/**
 * The line as it is written: without `timeLogIds`. A line that does not state the key is the line itself.
 */
function withoutTimeLogIds<L extends IInvoiceItemCreateInput>(line: L): L {
	if (!('timeLogIds' in line)) {
		return line;
	}
	const written: Partial<IInvoiceItemCreateInput> = { ...line };
	delete written.timeLogIds;
	return written as L;
}

/**
 * The organization a line states, by id or as an object: the organization whose time it may bill.
 *
 * @throws BadRequestException when the line states none.
 */
function organizationOf(line: IInvoiceItemCreateInput): ID {
	const organizationId = line.organizationId ?? line.organization?.id;
	if (!organizationId) {
		throw new BadRequestException(TIME_LOG_NOT_BILLABLE);
	}
	return organizationId;
}
