// cspell:disable -- the canary seeds made-up names, companies and addresses on purpose.
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { EverStatsCollector, statsPeriod } from './ever-stats-collector.service';
import { CORE_TABLES, createCoreTables, dropTables, globalStatsOver, insert, openTestDataSource, PLUGIN_TABLES, TEST_TARGETS } from './fixtures/test-db';

const SEPTEMBER = statsPeriod(new Date(Date.UTC(2026, 8, 15)));
const FEATURES = { FEATURE_INVOICE: true, FEATURE_JOB: false, FEATURE_OPEN_STATS: false, FEATURE_SOMETHING_NEW: true };

/** Strings a real database holds that must never reach a report. */
const SEEDED: string[] = [];
const seed = (value: string) => {
	SEEDED.push(value);
	return value;
};

describe.each(TEST_TARGETS)('EverStatsCollector on $name', (target) => {
	let dataSource: DataSource;
	const d = target.name;

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await createCoreTables(dataSource, d);
		await seedDatabase(dataSource, d);
	});

	afterAll(async () => {
		await dropTables(dataSource, d, [...PLUGIN_TABLES, ...CORE_TABLES]);
		await dataSource.destroy();
	});

	const collector = () => new EverStatsCollector(globalStatsOver(dataSource, d), dataSource, FEATURES, (work) => work());

	it('counts instance-wide, per currency in minor units, for the UTC month only (golden)', async () => {
		const collected = await collector().collect(SEPTEMBER);
		expect(collected).toEqual({
			counts: {
				tenants: 2,
				organizations: 3,
				users: 4,
				users_active_30d: 2,
				employees: 3,
				employees_active: 2,
				teams: 2,
				projects: 2,
				tasks: 5,
				contacts: 3,
				integrations_in_use: { github: 2, upwork: 1, other: 1 }
			},
			features: { invoice: true, job: false, open_stats: false },
			aggregates: {
				invoiced_minor: { EUR: 30075, JPY: 5000, KWD: 1235, USD: 100000 },
				invoices: 7,
				payments_minor: { EUR: 8000, USD: 550 },
				payments: 3,
				hours_tracked_min: 150
			}
		});
	});

	it('builds a report from them that carries none of the names, addresses, numbers or texts of the database (canary)', async () => {
		const collected = await collector().collect(SEPTEMBER);
		const built = new EverStatsBuilder().build({
			identity: { instanceId: randomUUID() },
			config: { country: 'ZZ', serves: ['gauzy'], installSource: 'self-hosted' },
			release: parseReleaseVersion('v111.47.0'),
			period: SEPTEMBER,
			final: false,
			collected,
			now: new Date(Date.UTC(2026, 8, 20))
		});
		expect(built.ok).toBe(true);
		if (!built.built) return;
		expect(SEEDED.length).toBeGreaterThan(20);
		expect(leaks(built.built.text)).toEqual([]);
		// Control: the same check finds one seeded e-mail address planted in a copy of the report.
		const planted = built.built.text.replace('"ZZ"', JSON.stringify(SEEDED.find((s) => s.includes('@'))));
		expect(leaks(planted)).toHaveLength(1);
	});

	it('reports a one-user installation in full (no small-instance suppression)', async () => {
		const small = await openTestDataSource({ name: 'better-sqlite3' });
		try {
			await createCoreTables(small, 'better-sqlite3');
			const tenantId = randomUUID();
			await insert(small, 'better-sqlite3', 'tenant', { id: tenantId, name: 'Solo' });
			await insert(small, 'better-sqlite3', 'user', { id: randomUUID(), tenantId, email: 'solo@solo.example', isActive: true });
			await insert(small, 'better-sqlite3', 'invoice', { id: randomUUID(), tenantId, invoiceNumber: '1', currency: 'EUR', totalValue: 12.34, isEstimate: false, invoiceDate: '2026-09-02 10:00:00' });
			const collected = await new EverStatsCollector(globalStatsOver(small, 'better-sqlite3'), small, {}, (work) => work()).collect(SEPTEMBER);
			expect(collected.counts).toMatchObject({ tenants: 1, users: 1 });
			expect(collected.aggregates).toMatchObject({ invoiced_minor: { EUR: 1234 }, invoices: 1 });
		} finally {
			await small.destroy();
		}
	});
});

function leaks(text: string): string[] {
	return SEEDED.filter((value) => text.includes(value));
}

async function seedDatabase(dataSource: DataSource, d: 'better-sqlite3' | 'postgres' | 'mysql'): Promise<void> {
	SEEDED.length = 0;
	const add = (table: string, values: Record<string, unknown>) => insert(dataSource, d, table, { id: randomUUID(), ...values });
	const acme = randomUUID();
	const zephyr = randomUUID();
	await insert(dataSource, d, 'tenant', { id: acme, name: seed('Acme Robotics GmbH') });
	await insert(dataSource, d, 'tenant', { id: zephyr, name: seed('Zephyr Consulting LLC') });
	await add('organization', { tenantId: acme, name: seed('Acme Robotics Berlin'), taxId: seed('DE811907980'), website: seed('https://acme-robotics.example') });
	await add('organization', { tenantId: acme, name: seed('Acme Robotics Lyon'), taxId: seed('FR40303265045'), website: seed('https://acme.example/lyon') });
	await add('organization', { tenantId: zephyr, name: seed('Zephyr Advisory'), taxId: seed('GB980780684'), website: seed('zephyr-advisory.example') });
	const users: Array<[string, string, string, string | null]> = [
		['jane.doe@acme-robotics.example', 'Jane', 'Doevenport', '2026-09-10 09:00:00'],
		['oskar.kowalczyk@acme-robotics.example', 'Oskar', 'Kowalczyk', '2026-09-11 09:00:00'],
		['li.wei@zephyr-advisory.example', 'Liwei', 'Zhangsun', null],
		['amara.okafor@zephyr-advisory.example', 'Amara', 'Okafordottir', null]
	];
	for (const [email, first, last, login] of users) {
		await add('user', { tenantId: acme, email: seed(email), firstName: seed(first), lastName: seed(last), lastLoginAt: login, isActive: true });
	}
	await add('user', { tenantId: acme, email: 'deleted@acme-robotics.example', firstName: 'Gone', lastName: 'User', deletedAt: '2026-09-01 00:00:00' });
	await add('employee', { tenantId: acme, isActive: true, isArchived: false });
	await add('employee', { tenantId: acme, isActive: true, isArchived: false });
	await add('employee', { tenantId: zephyr, isActive: false, isArchived: false });
	await add('employee', { tenantId: zephyr, isActive: true, deletedAt: '2026-09-01 00:00:00' });
	await add('organization_team', { tenantId: acme, name: seed('Firmware Wizards') });
	await add('organization_team', { tenantId: zephyr, name: seed('Tax Strategy Desk') });
	for (const title of ['Calibrate gripper arm', 'Audit Globex ledger', 'Draft Initech proposal', 'Fix Umbrella login', 'Renew Wonka contract']) {
		await add('task', { tenantId: acme, title: seed(title) });
	}
	await add('organization_project', { tenantId: acme, name: seed('Project Hyperion Gripper') });
	await add('organization_project', { tenantId: zephyr, name: seed('Globex Restructuring 2026') });
	const contacts: Array<[string, string, string]> = [
		['Globex Corporation', 'billing@globex-corp.example', '742 Evergreen Terrace, Springfield'],
		['Initech Systems', 'ap@initech-systems.example', '4120 Freidrich Lane, Austin'],
		['Umbrella Pharma', 'finance@umbrella-pharma.example', '1 Raccoon Plaza, Raccoon City']
	];
	for (const [name, email, address] of contacts) {
		await add('organization_contact', { tenantId: acme, name: seed(name), primaryEmail: seed(email), address: seed(address) });
	}
	await add('integration_tenant', { tenantId: acme, name: 'Github', isActive: true });
	await add('integration_tenant', { tenantId: zephyr, name: 'Github', isActive: true });
	await add('integration_tenant', { tenantId: acme, name: 'Upwork', isActive: true });
	await add('integration_tenant', { tenantId: acme, name: 'Upwork', isActive: true });
	await add('integration_tenant', { tenantId: acme, name: 'Jira', isActive: false });
	await add('integration_tenant', { tenantId: acme, name: seed('Acme_Private_Connector'), isActive: true });
	const invoice = (currency: string | null, totalValue: number, invoiceDate: string, extra: Record<string, unknown> = {}) =>
		add('invoice', { tenantId: acme, invoiceNumber: seed(`INV-ACME-${SEEDED.length}`), currency, totalValue, isEstimate: false, invoiceDate, ...extra });
	await invoice('EUR', 100.5, '2026-09-01 00:00:00');
	await invoice('EUR', 200.25, '2026-09-30 23:59:59');
	await invoice('USD', 1000, '2026-09-15 12:00:00');
	await invoice('JPY', 5000, '2026-09-15 12:00:00');
	await invoice('KWD', 1.2345, '2026-09-15 12:00:00');
	await invoice('eur', 10, '2026-09-15 12:00:00');
	await invoice(null, 5, '2026-09-15 12:00:00');
	await invoice('EUR', 999, '2026-09-15 12:00:00', { isEstimate: true });
	await invoice('EUR', 50, '2026-08-31 23:59:59');
	await invoice('EUR', 70, '2026-09-10 12:00:00', { deletedAt: '2026-09-11 00:00:00' });
	await invoice('EUR', 80, '2026-10-01 00:00:00');
	await add('payment', { tenantId: acme, note: seed('Paid by Globex via wire 4471'), currency: 'EUR', amount: 100, paymentDate: '2026-09-05 10:00:00' });
	await add('payment', { tenantId: acme, note: seed('Refund Initech overcharge'), currency: 'EUR', amount: -20, paymentDate: '2026-09-06 10:00:00' });
	await add('payment', { tenantId: zephyr, note: seed('Umbrella retainer'), currency: 'USD', amount: 5.5, paymentDate: '2026-09-07 10:00:00' });
	await add('payment', { tenantId: zephyr, note: 'August', currency: 'USD', amount: 9, paymentDate: '2026-08-07 10:00:00' });
	await add('time_log', { tenantId: acme, description: seed('Pairing with Jane on gripper'), startedAt: '2026-09-03 08:00:00', stoppedAt: '2026-09-03 10:00:00' });
	await add('time_log', { tenantId: zephyr, description: seed('Globex ledger review'), startedAt: '2026-09-04 08:00:00', stoppedAt: '2026-09-04 08:30:00' });
	await add('time_log', { tenantId: acme, description: 'still running', startedAt: '2026-09-05 08:00:00', stoppedAt: null });
	await add('time_log', { tenantId: acme, description: 'august', startedAt: '2026-08-05 08:00:00', stoppedAt: '2026-08-05 09:00:00' });
	await add('time_log', { tenantId: acme, description: 'negative', startedAt: '2026-09-06 09:00:00', stoppedAt: '2026-09-06 08:00:00' });
}
