import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EVER_CONNECT_CLOCK } from './ever-connect.constants';
import { EverConnectSql, num, Row, str } from './ever-connect-sql';

const REPORT = 'ever_connect_person_link_report';
const REQUEST = 'ever_connect_person_request';

/** One Ever ID link or unlink waiting to be reported (`ever_connect_person_link_report`). */
export interface PersonLinkReportRecord {
	id: string;
	op: 'link' | 'unlink';
	userId: string;
	tenantId: string | null;
	tenantName: string | null;
	issuer: string;
	subject: string;
	subjectHash: string;
	linkMethod: string | null;
	state: 'pending' | 'sent' | 'failed' | 'dropped';
	attempts: number;
	nextAttemptAt: number | null;
	lastError: string | null;
	sentAt: number | null;
	createdAt: number;
}

/** One person's request and its answer (`ever_connect_person_request`). */
export interface PersonRequestRecord {
	id: string;
	kind: 'deletion' | 'export';
	jobId: string;
	respondBy: number | null;
	result: string | null;
	reasonCode: string | null;
	legalBasis: string | null;
	exportUrlEncrypted: string | null;
	state: 'pending' | 'answered' | 'rejected';
	attempts: number;
	nextAttemptAt: number | null;
	lastError: string | null;
	answeredAt: number | null;
	createdAt: number;
}

function toReport(row: Row): PersonLinkReportRecord {
	return {
		id: String(row['id']),
		op: String(row['op']) as PersonLinkReportRecord['op'],
		userId: String(row['userId']),
		tenantId: str(row['tenantId']),
		tenantName: str(row['tenantName']),
		issuer: String(row['issuer']),
		subject: String(row['subject']),
		subjectHash: String(row['subjectHash']),
		linkMethod: str(row['linkMethod']),
		state: String(row['state']) as PersonLinkReportRecord['state'],
		attempts: num(row['attempts']) ?? 0,
		nextAttemptAt: num(row['nextAttemptAt']),
		lastError: str(row['lastError']),
		sentAt: num(row['sentAt']),
		createdAt: num(row['createdAt']) ?? 0
	};
}

function toRequest(row: Row): PersonRequestRecord {
	return {
		id: String(row['id']),
		kind: String(row['kind']) as PersonRequestRecord['kind'],
		jobId: String(row['jobId']),
		respondBy: num(row['respondBy']),
		result: str(row['result']),
		reasonCode: str(row['reasonCode']),
		legalBasis: str(row['legalBasis']),
		exportUrlEncrypted: str(row['exportUrlEncrypted']),
		state: String(row['state']) as PersonRequestRecord['state'],
		attempts: num(row['attempts']) ?? 0,
		nextAttemptAt: num(row['nextAttemptAt']),
		lastError: str(row['lastError']),
		answeredAt: num(row['answeredAt']),
		createdAt: num(row['createdAt']) ?? 0
	};
}

/**
 * The tables of Sign in with Ever ID and of a person's requests: the link reports waiting to be sent
 * (a retry table) and the requests received with their answers.
 */
@Injectable()
export class EverConnectIdentityStore {
	readonly sql: EverConnectSql;
	private readonly now: () => number;

	constructor(dataSource: DataSource, @Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }) {
		this.sql = new EverConnectSql(dataSource);
		this.now = clock?.now ?? (() => Date.now());
	}

	// ── Link reports ──────────────────────────────────────────────────────────

	/** Adds a report, due now. */
	async addReport(values: Omit<PersonLinkReportRecord, 'state' | 'attempts' | 'nextAttemptAt' | 'lastError' | 'sentAt' | 'createdAt'>): Promise<void> {
		const at = this.now();
		await this.sql.insertIgnore(REPORT, {
			...values,
			state: 'pending',
			attempts: 0,
			nextAttemptAt: at,
			createdAt: at,
			updatedAt: at
		});
	}

	async report(id: string): Promise<PersonLinkReportRecord | null> {
		const row = await this.sql.one(REPORT, { id });
		return row ? toReport(row) : null;
	}

	/** The reports of one user and identity, oldest first. */
	async reportsOf(userId: string, subjectHash: string): Promise<PersonLinkReportRecord[]> {
		const rows = await this.sql.select(REPORT, { userId, subjectHash }, { orderBy: [['createdAt', 'ASC']] });
		return rows.map(toReport);
	}

	/** Pending reports due at `at`, oldest first. */
	async dueReports(at: number, limit: number): Promise<PersonLinkReportRecord[]> {
		return (await this.due(REPORT, at, limit)).map(toReport);
	}

	async updateReport(id: string, values: Partial<Record<keyof PersonLinkReportRecord, unknown>>): Promise<void> {
		await this.sql.update(REPORT, { ...values, updatedAt: this.now() }, { id });
	}

	/** Every pending report gives up (Sign in with Ever ID was switched off): nothing more is sent. */
	async dropPendingReports(): Promise<number> {
		return this.sql.update(REPORT, { state: 'dropped', nextAttemptAt: null, updatedAt: this.now() }, { state: 'pending' });
	}

	// ── A person's requests ───────────────────────────────────────────────────

	/** Records a request the first time it is read. Returns whether it is new (a replay is not). */
	async addRequest(values: Pick<PersonRequestRecord, 'id' | 'kind' | 'jobId' | 'respondBy'>): Promise<boolean> {
		const at = this.now();
		return this.sql.insertIgnore(REQUEST, {
			...values,
			state: 'pending',
			attempts: 0,
			nextAttemptAt: null,
			createdAt: at,
			updatedAt: at
		});
	}

	async request(id: string): Promise<PersonRequestRecord | null> {
		const row = await this.sql.one(REQUEST, { id });
		return row ? toRequest(row) : null;
	}

	/** Answers waiting to be sent at `at` (they have a result), oldest first. */
	async dueRequests(at: number, limit: number): Promise<PersonRequestRecord[]> {
		return (await this.due(REQUEST, at, limit)).map(toRequest).filter((row) => row.result !== null);
	}

	async updateRequest(id: string, values: Partial<Record<keyof PersonRequestRecord, unknown>>): Promise<void> {
		await this.sql.update(REQUEST, { ...values, updatedAt: this.now() }, { id });
	}

	/** `state = 'pending' AND nextAttemptAt <= at`, oldest first. */
	private async due(table: string, at: number, limit: number): Promise<Row[]> {
		const q = (c: string) => this.sql.q(c);
		const { rows } = await this.sql.run(
			`SELECT * FROM ${q(table)} WHERE ${q('state')} = ${this.sql.ph(1)} AND ${q('nextAttemptAt')} IS NOT NULL AND ${q('nextAttemptAt')} <= ${this.sql.ph(2)} ` +
				`ORDER BY ${q('nextAttemptAt')} ASC LIMIT ${Math.max(1, Math.floor(limit))}`,
			['pending', at]
		);
		return rows;
	}
}
