import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Marie's rate goes from 40 to 50. Named with a day ("from 1 October"), the change gives her time from that day the
 * new rate; time an invoice bills keeps the price it was invoiced at, and a log that stores no rate is left alone
 * (the current rate prices it already). Run on SQLite with the tables TypeORM creates.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const OTHER_ORGANIZATION = '22222222-2222-4222-8222-222222222223';
const MARIE = '44444444-4444-4444-8444-444444444441';
const PAUL = '44444444-4444-4444-8444-444444444442';
const PROJECT = '55555555-5555-4555-8555-555555555551';
const INVOICE = '99999999-9999-4999-8999-999999999991';
const LINE = '99999999-9999-4999-8999-999999999992';

const LOG = {
	september: '77777777-7777-4777-8777-777777777771',
	october: '77777777-7777-4777-8777-777777777772',
	invoiced: '77777777-7777-4777-8777-777777777773',
	unstored: '77777777-7777-4777-8777-777777777774',
	paul: '77777777-7777-4777-8777-777777777775',
	removed: '77777777-7777-4777-8777-777777777776'
};

describe('re-pricing time from a day', () => {
	let dataSource: any;
	let file: string;
	let repricing: typeof import('./time-log-repricing');

	beforeAll(async () => {
		process.env.DB_TYPE = 'better-sqlite3';
		file = path.join(os.tmpdir(), `gauzy-repricing-${process.pid}-${Date.now()}.sqlite3`);
		const { coreEntities } = require('../../core/entities');
		const { DataSource } = require('typeorm');
		repricing = require('./time-log-repricing');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: file,
			entities: coreEntities,
			synchronize: true
		});
		await dataSource.initialize();
		await dataSource.query('PRAGMA foreign_keys = OFF');
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(file, { force: true });
	});

	/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
	const insert = async (table: string, row: Record<string, unknown>) => {
		const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
		const values: Record<string, unknown> = { ...row };
		for (const column of columns) {
			const needsPlaceholder =
				!(column.name in values) && column.notnull && column.dflt_value === null && !column.pk;
			if (!needsPlaceholder) continue;
			const type = String(column.type).toLowerCase();
			let placeholder: unknown = 'x';
			if (/date|time/.test(type)) placeholder = '2026-01-01 00:00:00';
			if (/int|bool|numeric|decimal|real|float/.test(type)) placeholder = 0;
			values[column.name] = placeholder;
		}
		const keys = Object.keys(values);
		await dataSource.query(
			`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
			keys.map((key) => values[key])
		);
	};

	const stored = {
		ratesStored: 1,
		billRateValue: 40,
		billRateCurrency: 'EUR',
		payRateValue: 25,
		projectBillRateValue: 90
	};

	beforeEach(async () => {
		for (const table of ['time_log', 'employee', 'invoice', 'invoice_item', 'organization_project_employee']) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		// Today's rates, after the raise
		await insert('employee', { ...scope, id: MARIE, billRateValue: 50, billRateCurrency: 'EUR', payRateValue: 30 });
		await dataSource.query(`DELETE FROM "organization"`);
		await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Studio', currency: 'BGN' });
		await insert('invoice', { ...scope, id: INVOICE, status: 'SENT' });
		await insert('invoice_item', { ...scope, id: LINE, invoiceId: INVOICE });
		const log = (id: string, startedAt: string, extra: Record<string, unknown> = {}) =>
			insert('time_log', {
				...scope,
				id,
				employeeId: MARIE,
				projectId: PROJECT,
				startedAt,
				stoppedAt: startedAt.replace('09:00', '10:00'),
				...stored,
				...extra
			});
		await log(LOG.september, '2026-09-30 09:00:00');
		await log(LOG.october, '2026-10-05 09:00:00');
		await log(LOG.invoiced, '2026-10-06 09:00:00', { invoiceItemId: LINE });
		await log(LOG.unstored, '2026-10-07 09:00:00', {
			ratesStored: null,
			billRateValue: null,
			billRateCurrency: null,
			payRateValue: null,
			projectBillRateValue: null
		});
		await log(LOG.removed, '2026-10-08 09:00:00', { deletedAt: '2026-10-09 00:00:00' });
		await log(LOG.paul, '2026-10-05 09:00:00', { employeeId: PAUL });
	});

	const ratesOf = async (id: string) => {
		const [row] = await dataSource.query(`SELECT * FROM "time_log" WHERE "id" = ?`, [id]);
		return row;
	};

	const october = { tenantId: TENANT, organizationId: ORGANIZATION, from: new Date('2026-10-01T00:00:00.000Z') };

	it(
		"gives Marie's time from 1 October her new billing rate, and only that",
		async () => {
			const count = await repricing.repriceMemberTime(dataSource.manager, october, MARIE, { billRateValue: 50 });

			expect(count).toBe(1);
			expect(await ratesOf(LOG.october)).toMatchObject({
				billRateValue: 50,
				billRateCurrency: 'EUR',
				payRateValue: 25
			});
			expect(await ratesOf(LOG.september)).toMatchObject({ billRateValue: 40 });
		},
		TIMEOUT
	);

	it(
		"changes a member's client rate and its currency, never the currency of the project's rate",
		async () => {
			await dataSource.query(`UPDATE "time_log" SET "projectBillRateCurrency" = 'EUR'`);

			await repricing.repriceMemberProjectTime(dataSource.manager, october, PROJECT, MARIE, {
				billRateValue: 95,
				currency: 'USD'
			});

			expect(await ratesOf(LOG.october)).toMatchObject({
				projectBillRateValue: 90,
				projectBillRateCurrency: 'EUR',
				projectMemberBillRateValue: 95,
				projectMemberBillRateCurrency: 'USD'
			});
		},
		TIMEOUT
	);

	it(
		"stores the organization's currency with a pay rate that states none",
		async () => {
			await repricing.repriceMemberTime(dataSource.manager, october, MARIE, { payRateValue: 30 });

			expect(await ratesOf(LOG.october)).toMatchObject({ payRateValue: 30, payRateCurrency: 'BGN' });
		},
		TIMEOUT
	);

	it(
		'keeps the price of invoiced time, of removed time, of a log that stores no rate and of other members',
		async () => {
			await repricing.repriceMemberTime(dataSource.manager, october, MARIE, {
				billRateValue: 50,
				payRateValue: 30
			});

			expect(await ratesOf(LOG.invoiced)).toMatchObject({ billRateValue: 40, payRateValue: 25 });
			expect(await ratesOf(LOG.removed)).toMatchObject({ billRateValue: 40 });
			expect(await ratesOf(LOG.unstored)).toMatchObject({ billRateValue: null, ratesStored: null });
			expect(await ratesOf(LOG.paul)).toMatchObject({ billRateValue: 40 });
		},
		TIMEOUT
	);

	it(
		're-prices invoiced time once its invoice is void, which frees it',
		async () => {
			await dataSource.query(`UPDATE "invoice" SET "status" = 'VOID'`);

			const count = await repricing.repriceMemberTime(dataSource.manager, october, MARIE, { payRateValue: 30 });

			expect(count).toBe(2);
			expect(await ratesOf(LOG.invoiced)).toMatchObject({ billRateValue: 40, payRateValue: 30 });
		},
		TIMEOUT
	);

	it(
		'applies the rate the change sent, even when another save changed it meanwhile',
		async () => {
			// A second admin saved 60 with no day between this change's save and its re-pricing
			await dataSource.query(`UPDATE "employee" SET "billRateValue" = 60 WHERE "id" = ?`, [MARIE]);

			await repricing.repriceMemberTime(dataSource.manager, october, MARIE, { billRateValue: 50 });

			expect(await ratesOf(LOG.october)).toMatchObject({ billRateValue: 50, billRateCurrency: 'EUR' });
		},
		TIMEOUT
	);

	it(
		"changes nothing in another organization's time",
		async () => {
			const elsewhere = { ...october, organizationId: OTHER_ORGANIZATION };

			expect(
				await repricing.repriceMemberTime(dataSource.manager, elsewhere, MARIE, {
					billRateValue: 50,
					payRateValue: 30
				})
			).toBe(0);
		},
		TIMEOUT
	);

	it(
		"gives a project's time from the day its new client rate, and a member's own client rate on it",
		async () => {
			const projectCount = await repricing.repriceProjectTime(dataSource.manager, october, PROJECT, {
				billRateValue: 120,
				currency: 'USD'
			});
			const memberCount = await repricing.repriceMemberProjectTime(dataSource.manager, october, PROJECT, MARIE, {
				billRateValue: 95,
				currency: 'USD'
			});

			expect(projectCount).toBe(2);
			expect(memberCount).toBe(1);
			expect(await ratesOf(LOG.october)).toMatchObject({
				projectBillRateValue: 120,
				projectBillRateCurrency: 'USD',
				projectMemberBillRateValue: 95,
				projectMemberBillRateCurrency: 'USD'
			});
			expect(await ratesOf(LOG.paul)).toMatchObject({
				projectBillRateValue: 120,
				projectMemberBillRateValue: null
			});
			expect(await ratesOf(LOG.september)).toMatchObject({ projectBillRateValue: 90 });
		},
		TIMEOUT
	);

	const allTime = { tenantId: TENANT, organizationId: ORGANIZATION, from: null };

	it(
		"gives all of Marie's time the new rate when the change names no day, invoiced time too, as reports priced it",
		async () => {
			const count = await repricing.repriceMemberTime(dataSource.manager, allTime, MARIE, { billRateValue: 50 });

			expect(count).toBe(3);
			for (const id of [LOG.september, LOG.october, LOG.invoiced]) {
				expect(await ratesOf(id)).toMatchObject({
					billRateValue: 50,
					billRateCurrency: 'EUR',
					payRateValue: 25
				});
			}
			expect(await ratesOf(LOG.removed)).toMatchObject({ billRateValue: 40 });
			expect(await ratesOf(LOG.unstored)).toMatchObject({ billRateValue: null, ratesStored: null });
			expect(await ratesOf(LOG.paul)).toMatchObject({ billRateValue: 40 });
		},
		TIMEOUT
	);

	it(
		'writes only the logs whose stored rate differs: sent again, a change completes one that failed',
		async () => {
			// A change whose re-pricing failed half-way: September already took the rate, October did not
			await dataSource.query(`UPDATE "time_log" SET "billRateValue" = 50 WHERE "id" = ?`, [LOG.september]);

			expect(await repricing.repriceMemberTime(dataSource.manager, allTime, MARIE, { billRateValue: 50 })).toBe(
				2
			);
			expect(await ratesOf(LOG.october)).toMatchObject({ billRateValue: 50 });
			// Sent once more, it finds nothing left to write
			expect(await repricing.repriceMemberTime(dataSource.manager, allTime, MARIE, { billRateValue: 50 })).toBe(
				0
			);
		},
		TIMEOUT
	);

	it(
		"reads whether the organization's time logs keep their rates: not unless it turned it on",
		async () => {
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			expect(await repricing.keepsTimeLogRates(dataSource.manager, scope)).toBe(false);

			await dataSource.query(`UPDATE "organization" SET "timeLogsKeepTheirRates" = 0`);
			expect(await repricing.keepsTimeLogRates(dataSource.manager, scope)).toBe(false);

			await dataSource.query(`UPDATE "organization" SET "timeLogsKeepTheirRates" = 1`);
			expect(await repricing.keepsTimeLogRates(dataSource.manager, scope)).toBe(true);
			expect(
				await repricing.keepsTimeLogRates(dataSource.manager, { ...scope, tenantId: OTHER_ORGANIZATION })
			).toBe(false);
		},
		TIMEOUT
	);
});
