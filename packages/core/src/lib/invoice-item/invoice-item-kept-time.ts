import { FindOptionsWhere, In } from 'typeorm';
import { EntityData, FilterQuery } from '@mikro-orm/core';
import { ID, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { InvoiceItem, TimeLog } from '../core/entities/internal';
import { prepareSQLQuery as p } from '../database/database.helper';
import { ILinesTransaction, savedLineId } from './invoice-item-billed-time';

/** A line an invoice holds, as stored, and the time logs that name it. */
export interface IHeldLine {
	line: Record<string, unknown>;
	timeLogIds: ID[];
}

/** A requested line that says what a held line said, at its position among the lines saved, and the time it keeps. */
export interface IKeptLine {
	index: number;
	timeLogIds: ID[];
}

/** A time log and the line it names. */
interface ITimeLogLink {
	timeLogId: ID;
	lineId: ID;
}

/** What a line says it bills: two lines that agree on all of it bill the same thing. */
const TEXT_FIELDS = ['description'];
const AMOUNT_FIELDS = ['price', 'quantity', 'totalValue'];
const SWITCH_FIELDS = ['applyTax', 'applyDiscount'];
const RECORD_FIELDS = [
	'invoiceId',
	'organizationId',
	'employeeId',
	'projectId',
	'taskId',
	'productId',
	'expenseId',
	'purchaseOrderLineId'
];

/**
 * Replaces an invoice's lines in the transaction given: deletes the lines, saves the new ones, and keeps on each new
 * line that says what an old line said the time the old line held (see {@link unchangedLinesOf}). Deleting a line
 * clears the link of the time it billed (the foreign key sets it to null), so the link is written again.
 *
 * @param service The service, on the transaction (see `inLinesTransaction`).
 * @param transaction The transaction.
 * @param invoiceId The invoice whose lines are replaced.
 * @param requested The new lines, as the request states them.
 * @param lines The new lines, as they are written.
 * @param named The time logs the new lines name, which go to the lines that name them.
 * @returns The new lines.
 */
export async function replaceLinesKeepingTime(
	service: TenantAwareCrudService<InvoiceItem>,
	transaction: ILinesTransaction,
	invoiceId: ID,
	requested: IInvoiceItemCreateInput[],
	lines: IInvoiceItemCreateInput[],
	named: ID[]
): Promise<InvoiceItem[]> {
	const held = await heldTimeOf(service, transaction, invoiceId);
	await service.delete({ invoiceId } as FindOptionsWhere<InvoiceItem>);
	const saved = await service.saveMany(lines);
	await keepTimeOfUnchangedLines(transaction, requested, saved, held, named);
	return saved;
}

/**
 * Pairs each requested line that names no time logs with a held line that says the same thing (same text, amounts,
 * tax and discount switches, invoice, organization, and billed records), each held line once, in the order of the
 * request. A requested line that names time logs, even none, bills exactly those.
 *
 * @param requested The new lines, as the request states them.
 * @param held The lines the invoice holds time on.
 * @returns The requested lines that keep time, and the time each keeps.
 */
export function unchangedLinesOf(requested: IInvoiceItemCreateInput[], held: IHeldLine[]): IKeptLine[] {
	const unpaired = [...held];
	const kept: IKeptLine[] = [];
	for (const [index, line] of requested.entries()) {
		const namesTime = Array.isArray(line.timeLogIds);
		if (namesTime) {
			continue;
		}
		const requestedLine = line as unknown as Record<string, unknown>;
		const position = unpaired.findIndex((heldLine) => saySameThing(requestedLine, heldLine.line));
		if (position === -1) {
			continue;
		}
		const [pair] = unpaired.splice(position, 1);
		kept.push({ index, timeLogIds: pair.timeLogIds });
	}
	return kept;
}

/**
 * The invoice's lines that time logs name, as the caller reads them (the lines a replacement deletes), each with
 * those time logs. A removed line or time log holds nothing and is left out.
 */
async function heldTimeOf(
	service: TenantAwareCrudService<InvoiceItem>,
	transaction: ILinesTransaction,
	invoiceId: ID
): Promise<IHeldLine[]> {
	const tenantId = RequestContext.currentTenantId();
	if (!tenantId) {
		return [];
	}
	const lines = await service.find({ where: { invoiceId } as FindOptionsWhere<InvoiceItem> });
	if (lines.length === 0) {
		return [];
	}
	const lineIds = lines.map((line) => line.id);
	const links = await timeLogLinksOf(transaction, lineIds, tenantId);
	const timeLogIdsByLine = new Map<ID, ID[]>();
	for (const link of links) {
		const timeLogIds = timeLogIdsByLine.get(link.lineId) ?? [];
		timeLogIds.push(link.timeLogId);
		timeLogIdsByLine.set(link.lineId, timeLogIds);
	}
	const linesHoldingTime = lines.filter((line) => timeLogIdsByLine.has(line.id));
	return linesHoldingTime.map((line) => ({
		line: line as unknown as Record<string, unknown>,
		timeLogIds: timeLogIdsByLine.get(line.id)
	}));
}

/**
 * Writes again, on the time each unchanged line kept, the new line that replaced it. Only a time log the deletion
 * left without a line is written: one another invoice billed in the meantime keeps that invoice's line.
 */
async function keepTimeOfUnchangedLines(
	transaction: ILinesTransaction,
	requested: IInvoiceItemCreateInput[],
	saved: Array<{ id?: ID }>,
	held: IHeldLine[],
	named: ID[]
): Promise<void> {
	const kept = unchangedLinesOf(requested, held);
	const namedTimeLogs = new Set(named);
	const tenantId = RequestContext.currentTenantId();
	for (const line of kept) {
		const timeLogIds = line.timeLogIds.filter((timeLogId) => !namedTimeLogs.has(timeLogId));
		if (timeLogIds.length === 0) {
			continue;
		}
		const lineId = savedLineId(saved, line.index);
		await linkReleasedTimeLogs(transaction, lineId, timeLogIds, tenantId);
	}
}

async function timeLogLinksOf(transaction: ILinesTransaction, lineIds: ID[], tenantId: ID): Promise<ITimeLogLink[]> {
	if (transaction.mikroOrm) {
		const where = { invoiceItem: { $in: lineIds }, tenantId } as FilterQuery<TimeLog>;
		const logs = await transaction.mikroOrm.find(TimeLog, where, { fields: ['id', 'invoiceItem'] as never });
		return logs.map((log) => ({ timeLogId: log.id, lineId: referencedId(log.invoiceItem) }));
	}
	const logs = await transaction.typeOrm.find(TimeLog, {
		where: { invoiceItemId: In(lineIds), tenantId },
		select: { id: true, invoiceItemId: true }
	});
	return logs.map((log) => ({ timeLogId: log.id, lineId: log.invoiceItemId }));
}

async function linkReleasedTimeLogs(
	transaction: ILinesTransaction,
	lineId: ID,
	timeLogIds: ID[],
	tenantId: ID
): Promise<void> {
	if (transaction.mikroOrm) {
		const where = { id: { $in: timeLogIds }, tenantId, invoiceItem: null } as FilterQuery<TimeLog>;
		// A native update does not stamp the update date.
		const linked = { invoiceItem: lineId, updatedAt: new Date() } as EntityData<TimeLog>;
		await transaction.mikroOrm.nativeUpdate(TimeLog, where, linked);
		return;
	}
	await transaction.typeOrm
		.createQueryBuilder()
		.update(TimeLog)
		.set({ invoiceItemId: lineId })
		.where(p(`"id" IN (:...timeLogIds)`), { timeLogIds })
		.andWhere(p(`"tenantId" = :tenantId`), { tenantId })
		.andWhere(p(`"invoiceItemId" IS NULL`))
		.execute();
}

type LineReader = (line: Record<string, unknown>, field: string) => unknown;

function saySameThing(requested: Record<string, unknown>, held: Record<string, unknown>): boolean {
	const sameText = agreeOn(TEXT_FIELDS, textAt, requested, held);
	const sameAmounts = agreeOn(AMOUNT_FIELDS, amountAt, requested, held);
	const sameSwitches = agreeOn(SWITCH_FIELDS, switchAt, requested, held);
	const sameRecords = agreeOn(RECORD_FIELDS, recordIdOf, requested, held);
	return sameText && sameAmounts && sameSwitches && sameRecords;
}

function agreeOn(
	fields: string[],
	read: LineReader,
	requested: Record<string, unknown>,
	held: Record<string, unknown>
): boolean {
	return fields.every((field) => read(requested, field) === read(held, field));
}

function textAt(line: Record<string, unknown>, field: string): string {
	return textOf(line[field]);
}

/** An amount, whether the database hands it over as a number or as the text of a decimal. */
function amountAt(line: Record<string, unknown>, field: string): number {
	return Number(line[field]);
}

/** A switch a line leaves unset is off. */
function switchAt(line: Record<string, unknown>, field: string): boolean {
	return line[field] === true;
}

function textOf(value: unknown): string {
	const isAbsent = value === undefined || value === null;
	if (isAbsent) {
		return '';
	}
	return String(value);
}

/** A record a line names, by its id or through the relation the id belongs to; an empty string for none. */
function recordIdOf(line: Record<string, unknown>, idField: string): string {
	const relation = idField.slice(0, -'Id'.length);
	const named = line[idField] ?? referencedId(line[relation]);
	return textOf(named);
}

/** The id of a record a relation holds: the record, a reference to it, or its id alone. */
function referencedId(relation: unknown): ID | undefined {
	if (typeof relation === 'string') {
		return relation;
	}
	return (relation as { id?: ID } | null | undefined)?.id;
}
