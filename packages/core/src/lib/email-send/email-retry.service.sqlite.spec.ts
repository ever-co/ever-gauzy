// cspell:ignore ESOCKET ECONNREFUSED EENVELOPE
/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailStatusEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { EmailHistory } from '../core/entities/internal';
import { mikroOrmOutsideRequest } from '../core/testing/mikro-orm-outside-request';
import { AddEmailSentRetryColumns1791000019950 } from '../database/migrations/1791000019950-AddEmailSentRetryColumns';
import { EMAIL_RETRY_BATCH_SIZE, EMAIL_RETRY_SWEEP_MS } from './email-retry.policy';
import { EmailRetryService } from './email-retry.service';

/**
 * The retry sweep against a real SQLite database: `email_sent` as the platform had it before the retry, with the
 * migration's columns added, and the `email_template` rows a row names. The mail transport is doubled; what is under
 * test is which rows the sweep sends, when, how many times, and what it leaves on each.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = new Date('2026-12-01T10:00:00.000Z');
/** A time as TypeORM writes it on SQLite: UTC, without its zone. */
const stored = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');
const fromNow = (ms: number) => new Date(NOW.getTime() + ms);

const TENANT = randomUUID();
const ORGANIZATION = randomUUID();

/** What nodemailer raises when the server refused the connection. */
const refused = () =>
	Object.assign(new Error('connect ECONNREFUSED'), {
		code: 'ESOCKET',
		originalCode: 'ECONNREFUSED',
		command: 'CONN'
	});
/** A permanent refusal of the address, naming it as providers do. */
const noSuchUser = () =>
	Object.assign(new Error('550 5.1.1 <ada@example.test> no such user'), {
		code: 'EENVELOPE',
		responseCode: 550,
		command: 'RCPT TO'
	});

interface IRowFixture {
	template?: string;
	status?: EmailStatusEnum | null;
	retryCount?: number | null;
	/** When the retry is due, from NOW; null: none. */
	dueIn?: number | null;
	/** When the original send was, from NOW. */
	createdIn?: number;
	email?: string;
	content?: string | null;
	organizationId?: string | null;
}

describe('EmailRetryService on SQLite', () => {
	let dataSource: DataSource;
	let templates: Map<string, string>;
	let send: jest.Mock;
	let getEmailInstance: jest.Mock;
	let transporterName: string;
	let service: EmailRetryService;
	let previousSwitch: string | undefined;

	beforeEach(async () => {
		previousSwitch = process.env.EMAIL_RETRY_ENABLED;
		delete process.env.EMAIL_RETRY_ENABLED;
		for (const level of ['log', 'warn', 'error', 'debug'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
		}

		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE "email_template" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "languageCode" varchar, "organizationId" varchar, "tenantId" varchar, "deletedAt" datetime)`
		);
		// `email_sent` as it was before the retry columns.
		await dataSource.query(
			`CREATE TABLE "email_sent" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar, "content" varchar, "email" varchar NOT NULL, "status" varchar, "userId" varchar, "emailTemplateId" varchar NOT NULL)`
		);
		const runner = dataSource.createQueryRunner();
		await new AddEmailSentRetryColumns1791000019950().up(runner);
		await runner.release();

		templates = new Map();
		for (const name of ['welcome-user', 'employee-join', 'password', 'timesheet-action']) {
			const id = randomUUID();
			templates.set(name, id);
			await dataSource.query(`INSERT INTO "email_template" ("id", "name", "languageCode") VALUES (?, ?, 'en')`, [
				id,
				`${name}/html`
			]);
		}

		transporterName = 'SMTP';
		send = jest.fn(async () => ({ messageId: '<m@gauzy.test>' }));
		getEmailInstance = jest.fn(async () => ({
			config: { transport: { transporter: { name: transporterName }, sendMail: jest.fn() } },
			send
		}));
		service = newService();
	});

	afterEach(async () => {
		await dataSource.destroy();
		jest.restoreAllMocks();
		if (previousSwitch === undefined) delete process.env.EMAIL_RETRY_ENABLED;
		else process.env.EMAIL_RETRY_ENABLED = previousSwitch;
	});

	function newService(orm?: unknown): EmailRetryService {
		return new EmailRetryService(
			dataSource.getRepository(EmailHistory) as never,
			{ getEmailInstance } as never,
			orm as never
		);
	}

	/** One `email_sent` row; by default a welcome email that failed 5 minutes ago and is due now. */
	async function aRow(fixture: IRowFixture = {}): Promise<string> {
		const id = randomUUID();
		const template = fixture.template ?? 'welcome-user';
		await dataSource.query(
			`INSERT INTO "email_sent" ("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "status", "emailTemplateId", "retryCount", "nextRetryAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				stored(fromNow(fixture.createdIn ?? -5 * MINUTE)),
				stored(fromNow(fixture.createdIn ?? -5 * MINUTE)),
				TENANT,
				fixture.organizationId === undefined ? ORGANIZATION : fixture.organizationId,
				`Subject of ${template}`,
				fixture.content === undefined ? `<p>Welcome</p>` : fixture.content,
				fixture.email ?? 'ada@example.test',
				fixture.status === undefined ? EmailStatusEnum.FAILED : fixture.status,
				templates.get(template),
				fixture.retryCount === undefined ? 0 : fixture.retryCount,
				fixture.dueIn === undefined
					? stored(NOW)
					: fixture.dueIn === null
						? null
						: stored(fromNow(fixture.dueIn))
			]
		);
		return id;
	}

	async function rowOf(id: string): Promise<Record<string, any>> {
		const [row] = await dataSource.query(`SELECT * FROM "email_sent" WHERE "id" = ?`, [id]);
		return row;
	}

	const sentTo = () => send.mock.calls.map(([options]) => options.message.to);

	it('never touches an email that failed before the retry existed, or for a reason a retry would not fix', async () => {
		// Rows as every row written before the migration reads: no retry state at all
		const old = await aRow({ retryCount: null, dueIn: null, createdIn: -10 * MINUTE });
		const sent = await aRow({ retryCount: null, dueIn: null, status: EmailStatusEnum.SENT });
		const unknown = await aRow({ retryCount: null, dueIn: null, status: null });
		const before = await Promise.all([old, sent, unknown].map(rowOf));

		const report = await service.sweep(NOW);

		expect(report).toEqual({ due: 0, sent: 0, rescheduled: 0, gaveUp: 0, taken: 0, dropped: 0, capped: false });
		expect(send).not.toHaveBeenCalled();
		expect(getEmailInstance).not.toHaveBeenCalled();
		expect(await Promise.all([old, sent, unknown].map(rowOf))).toEqual(before);
	});

	it("claims a due email before it sends it, sends the stored message through the row's mail settings, and files it SENT", async () => {
		const id = await aRow({ email: 'ada@example.test' });
		let whileSending: Record<string, any> | undefined;
		send.mockImplementationOnce(async () => {
			whileSending = await rowOf(id);
			return {};
		});

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ due: 1, sent: 1 });
		// Claimed before the send: the next retry is no longer due, the count has moved on, and the claim is stamped
		// with the sweep's moment for the installation-wide cap
		expect(whileSending).toMatchObject({
			status: EmailStatusEnum.FAILED,
			retryCount: 1,
			nextRetryAt: null,
			lastRetryAt: stored(NOW)
		});
		expect(getEmailInstance).toHaveBeenCalledWith({ organizationId: ORGANIZATION, tenantId: TENANT });
		expect(send).toHaveBeenCalledWith({
			message: { to: 'ada@example.test', subject: 'Subject of welcome-user', html: '<p>Welcome</p>' }
		});
		expect(await rowOf(id)).toMatchObject({ status: EmailStatusEnum.SENT, retryCount: 1, nextRetryAt: null });

		// Sent once: the next sweep finds nothing
		await service.sweep(fromNow(HOUR));
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('sends nothing for an email another process claimed between the read and the claim', async () => {
		const id = await aRow();
		const findDue = (service as any).findDue.bind(service);
		jest.spyOn(service as any, 'findDue').mockImplementation(async (now: Date) => {
			const due = await findDue(now);
			// Another API instance's sweep claims it first
			await dataSource.query(`UPDATE "email_sent" SET "retryCount" = 1, "nextRetryAt" = NULL WHERE "id" = ?`, [
				id
			]);
			return due;
		});

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ due: 1, taken: 1, sent: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('sends each email once when two sweeps run at the same time', async () => {
		const ids = [
			await aRow({ email: 'a@example.test' }),
			await aRow({ email: 'b@example.test' }),
			await aRow({ email: 'c@example.test' })
		];

		const [first, second] = await Promise.all([newService().sweep(NOW), newService().sweep(NOW)]);

		expect(sentTo().sort()).toEqual(['a@example.test', 'b@example.test', 'c@example.test']);
		expect(first.sent + second.sent).toBe(3);
		expect(first.taken + second.taken).toBe(first.due + second.due - 3);
		for (const id of ids) {
			expect(await rowOf(id)).toMatchObject({ status: EmailStatusEnum.SENT, retryCount: 1 });
		}
	});

	it('waits for an email whose retry is not due yet', async () => {
		const id = await aRow({ dueIn: 2 * MINUTE });

		expect(await service.sweep(NOW)).toMatchObject({ due: 0 });
		expect(send).not.toHaveBeenCalled();

		await service.sweep(fromNow(2 * MINUTE));
		expect(sentTo()).toEqual(['ada@example.test']);
		expect(await rowOf(id)).toMatchObject({ status: EmailStatusEnum.SENT });
	});

	it('never retries an email older than two hours, even one still marked due', async () => {
		const id = await aRow({ createdIn: -2 * HOUR - MINUTE, dueIn: -HOUR });

		expect(await service.sweep(NOW)).toMatchObject({ due: 0 });
		expect(send).not.toHaveBeenCalled();
		expect(await rowOf(id)).toMatchObject({ retryCount: 0, nextRetryAt: stored(fromNow(-HOUR)) });
	});

	it('never retries an email whose two retries are spent', async () => {
		await aRow({ retryCount: 2 });

		expect(await service.sweep(NOW)).toMatchObject({ due: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('reschedules a first retry that failed for a transient reason 30 minutes later', async () => {
		const id = await aRow();
		send.mockRejectedValueOnce(refused());

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ due: 1, rescheduled: 1, sent: 0 });
		expect(await rowOf(id)).toMatchObject({
			status: EmailStatusEnum.FAILED,
			retryCount: 1,
			nextRetryAt: stored(fromNow(30 * MINUTE)),
			lastErrorCode: 'ESOCKET ECONNREFUSED CONN'
		});
	});

	it('gives up after the second retry: three attempts in all, counting the original', async () => {
		const id = await aRow();
		send.mockRejectedValue(refused());

		await service.sweep(NOW); // retry 1 of 2
		await service.sweep(fromNow(30 * MINUTE)); // retry 2 of 2
		const last = await rowOf(id);
		await service.sweep(fromNow(HOUR)); // nothing left

		expect(send).toHaveBeenCalledTimes(2);
		expect(last).toMatchObject({ status: EmailStatusEnum.FAILED, retryCount: 2, nextRetryAt: null });
		expect(await rowOf(id)).toEqual(last);
	});

	it('gives up on a retry that failed for good, and keeps the code without the address', async () => {
		const id = await aRow();
		send.mockRejectedValueOnce(noSuchUser());

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ gaveUp: 1, rescheduled: 0 });
		expect(await rowOf(id)).toMatchObject({
			retryCount: 1,
			nextRetryAt: null,
			lastErrorCode: 'EENVELOPE 550 RCPT TO'
		});
		expect(JSON.stringify(await rowOf(id))).not.toContain('example.test>');
	});

	it('gives up rather than schedule a retry that would come after the maximum age', async () => {
		const id = await aRow({ createdIn: -HOUR - 45 * MINUTE });
		send.mockRejectedValueOnce(refused());

		await service.sweep(NOW);

		expect(await rowOf(id)).toMatchObject({ retryCount: 1, nextRetryAt: null });
	});

	it("gives up when a provider plugin's transport failed: its error says nothing of an SMTP step", async () => {
		const id = await aRow();
		transporterName = 'Resend';
		send.mockRejectedValueOnce(refused());

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ gaveUp: 1 });
		expect(await rowOf(id)).toMatchObject({ retryCount: 1, nextRetryAt: null });
	});

	it(`sends at most ${EMAIL_RETRY_BATCH_SIZE} a sweep, the longest due first, and leaves the rest due`, async () => {
		const ids: string[] = [];
		for (let index = 0; index < EMAIL_RETRY_BATCH_SIZE + 5; index++) {
			ids.push(
				await aRow({ email: `r${String(index).padStart(2, '0')}@example.test`, dueIn: -(index + 1) * 1000 })
			);
		}

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ due: EMAIL_RETRY_BATCH_SIZE, sent: EMAIL_RETRY_BATCH_SIZE });
		// The longest due (the highest index) went first
		expect(sentTo()).toEqual(
			ids
				.map((_, index) => `r${String(index).padStart(2, '0')}@example.test`)
				.reverse()
				.slice(0, EMAIL_RETRY_BATCH_SIZE)
		);
		const left = await dataSource.query(
			`SELECT "email" FROM "email_sent" WHERE "nextRetryAt" IS NOT NULL ORDER BY "email"`
		);
		expect(left.map(({ email }) => email)).toEqual([
			'r00@example.test',
			'r01@example.test',
			'r02@example.test',
			'r03@example.test',
			'r04@example.test'
		]);
	});

	describe('the installation-wide cap', () => {
		/** Every due row, as the sweep reads one (the same columns), with no batch limit. */
		const allDue = (): Promise<EmailHistory[]> =>
			dataSource
				.getRepository(EmailHistory)
				.createQueryBuilder('email')
				.innerJoin('email.emailTemplate', 'template')
				.select([
					'email.id',
					'email.tenantId',
					'email.organizationId',
					'email.email',
					'email.name',
					'email.content',
					'email.retryCount',
					'email.nextRetryAt',
					'email.createdAt',
					'template.id',
					'template.name'
				])
				.where('email.nextRetryAt IS NOT NULL')
				.orderBy('email.email', 'ASC')
				.getMany();

		const claimedSince = async (since: Date): Promise<number> => {
			const [{ count }] = await dataSource.query(
				`SELECT COUNT(*) AS "count" FROM "email_sent" WHERE "lastRetryAt" >= ?`,
				[stored(since)]
			);
			return Number(count);
		};

		async function dueRows(count: number): Promise<void> {
			for (let index = 0; index < count; index++) {
				await aRow({ email: `r${String(index).padStart(2, '0')}@example.test` });
			}
		}

		it(`two processes sweeping different due emails together send at most ${EMAIL_RETRY_BATCH_SIZE} + 1 in one period`, async () => {
			await dueRows(2 * EMAIL_RETRY_BATCH_SIZE);
			const due = await allDue();
			// Two API processes, each having read a full batch of its own: without the cap they would send 40
			const first = newService();
			const second = newService();
			jest.spyOn(first as any, 'findDue').mockResolvedValue(due.slice(0, EMAIL_RETRY_BATCH_SIZE));
			jest.spyOn(second as any, 'findDue').mockResolvedValue(due.slice(EMAIL_RETRY_BATCH_SIZE));

			const reports = await Promise.all([first.sweep(NOW), second.sweep(NOW)]);

			const sent = sentTo();
			expect(new Set(sent).size).toBe(sent.length);
			expect(sent.length).toBeGreaterThanOrEqual(EMAIL_RETRY_BATCH_SIZE);
			// The count both read before a claim can be one short of the cap: one extra per concurrent sweep
			expect(sent.length).toBeLessThanOrEqual(EMAIL_RETRY_BATCH_SIZE + 1);
			expect(reports.some((report) => report.capped)).toBe(true);
			expect(await claimedSince(fromNow(-EMAIL_RETRY_SWEEP_MS))).toBe(sent.length);
		});

		it('caps three processes as well: never a batch per process', async () => {
			await dueRows(3 * EMAIL_RETRY_BATCH_SIZE);
			const due = await allDue();
			const sweeps = [0, 1, 2].map((index) => {
				const process = newService();
				jest.spyOn(process as any, 'findDue').mockResolvedValue(
					due.slice(index * EMAIL_RETRY_BATCH_SIZE, (index + 1) * EMAIL_RETRY_BATCH_SIZE)
				);
				return process.sweep(NOW);
			});

			await Promise.all(sweeps);

			expect(sentTo().length).toBeGreaterThanOrEqual(EMAIL_RETRY_BATCH_SIZE);
			expect(sentTo().length).toBeLessThanOrEqual(EMAIL_RETRY_BATCH_SIZE + 2);
		});

		it('a second sweep within the period, after a full batch, sends nothing; the cap frees up after the period', async () => {
			await dueRows(EMAIL_RETRY_BATCH_SIZE + 10);

			expect(await service.sweep(NOW)).toMatchObject({ sent: EMAIL_RETRY_BATCH_SIZE, capped: false });

			// Another process (or the same one) a minute later: the period's batch is spent, whatever is due
			const later = await newService().sweep(fromNow(MINUTE));
			expect(later).toMatchObject({ due: 10, sent: 0, taken: 0, capped: true });
			expect(send).toHaveBeenCalledTimes(EMAIL_RETRY_BATCH_SIZE);
			const [{ waiting }] = await dataSource.query(
				`SELECT COUNT(*) AS "waiting" FROM "email_sent" WHERE "nextRetryAt" IS NOT NULL AND "retryCount" = 0`
			);
			expect(Number(waiting)).toBe(10);

			// Once the period is over, the rest goes
			const next = await service.sweep(fromNow(EMAIL_RETRY_SWEEP_MS + 1));
			expect(next).toMatchObject({ due: 10, sent: 10, capped: false });
			expect(send).toHaveBeenCalledTimes(EMAIL_RETRY_BATCH_SIZE + 10);
		});

		it('counts the claims of the period whatever became of them: sent, failed again or given up', async () => {
			const ids: string[] = [];
			for (let index = 0; index < EMAIL_RETRY_BATCH_SIZE - 1; index++) ids.push(await aRow());
			// Claimed by another process two minutes ago and since settled every way a claim can be
			await dataSource.query(
				`UPDATE "email_sent" SET "lastRetryAt" = ?, "retryCount" = 1, "nextRetryAt" = NULL, "status" = CASE WHEN rowid % 2 = 0 THEN 'SENT' ELSE 'FAILED' END WHERE "id" IN (${ids
					.map(() => '?')
					.join(', ')})`,
				[stored(fromNow(-2 * MINUTE)), ...ids]
			);
			await aRow({ email: 'one@example.test' });
			await aRow({ email: 'two@example.test' });

			const report = await service.sweep(NOW);

			expect(report).toMatchObject({ due: 2, sent: 1, capped: true });
			expect(sentTo()).toHaveLength(1);
		});

		it('stops before any claim when the count of recent claims cannot be read', async () => {
			const id = await aRow();
			const before = await rowOf(id);
			jest.spyOn(service as any, 'claimedInThePeriod').mockRejectedValue(new Error('database unavailable'));

			await expect(service.sweep(NOW)).rejects.toThrow('database unavailable');

			expect(send).not.toHaveBeenCalled();
			expect(await rowOf(id)).toEqual(before);
		});
	});

	it('sends one email at a time', async () => {
		for (let index = 0; index < 5; index++) await aRow({ email: `r${index}@example.test` });
		let inFlight = 0;
		let most = 0;
		send.mockImplementation(async () => {
			inFlight += 1;
			most = Math.max(most, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 5));
			inFlight -= 1;
			return {};
		});

		await service.sweep(NOW);

		expect(send).toHaveBeenCalledTimes(5);
		expect(most).toBe(1);
	});

	it('starts no send once its time budget is spent, and leaves the emails due and unclaimed', async () => {
		const id = await aRow();

		const report = await service.sweep(NOW, 0);

		expect(report).toMatchObject({ due: 1, sent: 0, taken: 0 });
		expect(send).not.toHaveBeenCalled();
		expect(await rowOf(id)).toMatchObject({ retryCount: 0, nextRetryAt: stored(NOW) });
	});

	it('does nothing at all while EMAIL_RETRY_ENABLED=false', async () => {
		const id = await aRow();
		const before = await rowOf(id);
		process.env.EMAIL_RETRY_ENABLED = 'false';

		expect(await service.sweep(NOW)).toMatchObject({ due: 0, sent: 0 });
		expect(send).not.toHaveBeenCalled();
		expect(await rowOf(id)).toEqual(before);
	});

	it('takes an email of a template that is not retried out of the retries, unsent', async () => {
		const password = await aRow({ template: 'password' });
		const action = await aRow({ template: 'timesheet-action' });

		const report = await service.sweep(NOW);

		expect(report).toMatchObject({ due: 2, dropped: 2, sent: 0 });
		expect(send).not.toHaveBeenCalled();
		expect(await rowOf(password)).toMatchObject({ nextRetryAt: null });
		expect(await rowOf(action)).toMatchObject({ nextRetryAt: null });
	});

	it('takes an email with nothing to send out of the retries, unsent', async () => {
		const id = await aRow({ content: null });

		expect(await service.sweep(NOW)).toMatchObject({ dropped: 1 });
		expect(send).not.toHaveBeenCalled();
		expect(await rowOf(id)).toMatchObject({ nextRetryAt: null });
	});

	it('never retries an email that went, even one still marked due', async () => {
		await aRow({ status: EmailStatusEnum.SENT });

		expect(await service.sweep(NOW)).toMatchObject({ due: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('sends through the platform default when the row names no organization', async () => {
		await aRow({ organizationId: null });

		await service.sweep(NOW);

		expect(getEmailInstance).toHaveBeenCalledWith({ organizationId: null, tenantId: TENANT });
	});

	it('under DB_ORM=mikro-orm, sends each email in a MikroORM request context of its own', async () => {
		const mikroOrm = await mikroOrmOutsideRequest();
		const sentThrough: unknown[] = [];
		send.mockImplementation(async () => {
			// The mail settings are read through MikroORM there, which refuses its global EntityManager outside a request
			sentThrough.push(await mikroOrm.write());
			return {};
		});
		const previousOrm = process.env.DB_ORM;
		process.env.DB_ORM = 'mikro-orm';
		try {
			await aRow({ email: 'a@example.test' });
			await aRow({ email: 'b@example.test' });

			const report = await newService(mikroOrm.orm).sweep(NOW);

			expect(report).toMatchObject({ due: 2, sent: 2 });
			expect(sentThrough).toHaveLength(2);
			expect(sentThrough[0]).not.toBe(sentThrough[1]);
			expect(sentThrough).not.toContain(mikroOrm.orm.em);
		} finally {
			if (previousOrm === undefined) delete process.env.DB_ORM;
			else process.env.DB_ORM = previousOrm;
			await mikroOrm.close();
		}
	});
});
