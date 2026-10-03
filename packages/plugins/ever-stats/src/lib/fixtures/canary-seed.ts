// cspell:disable -- the canary seeds made-up names, companies and addresses on purpose.
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { insert, TestDialect } from './test-db';

/** What {@link seedCanaryDatabase} wrote. */
export interface CanarySeed {
	/** Every name, address, number and text of the database that must never reach a report. */
	seeded: string[];
	/** The two tenants: Acme holds most rows, Zephyr the rest. */
	acme: string;
	zephyr: string;
	/** The ids of the four users of Acme, oldest first (all four are in Acme's tenant). */
	users: string[];
}

/**
 * A two-tenant database with personal and business data in every column a real one has: names,
 * e-mail addresses, company names, tax ids, websites, postal addresses, invoice numbers, payment
 * notes, task and project names, time-log texts, a private integration name.
 *
 * The expected instance-wide numbers for September 2026 (counted on 2026-09-20) are
 * {@link CANARY_GOLDEN}.
 */
export async function seedCanaryDatabase(dataSource: DataSource, d: TestDialect): Promise<CanarySeed> {
	const seeded: string[] = [];
	const seed = (value: string) => {
		seeded.push(value);
		return value;
	};
	const add = (table: string, values: Record<string, unknown>) => insert(dataSource, d, table, { id: randomUUID(), ...values });
	const acme = randomUUID();
	const zephyr = randomUUID();
	await insert(dataSource, d, 'tenant', { id: acme, name: seed('Acme Robotics GmbH') });
	await insert(dataSource, d, 'tenant', { id: zephyr, name: seed('Zephyr Consulting LLC') });
	await add('organization', { tenantId: acme, name: seed('Acme Robotics Berlin'), taxId: seed('DE811907980'), website: seed('https://acme-robotics.example') });
	await add('organization', { tenantId: acme, name: seed('Acme Robotics Lyon'), taxId: seed('FR40303265045'), website: seed('https://acme.example/lyon') });
	await add('organization', { tenantId: zephyr, name: seed('Zephyr Advisory'), taxId: seed('GB980780684'), website: seed('zephyr-advisory.example') });
	const people: Array<[string, string, string, string | null, string]> = [
		['jane.doe@acme-robotics.example', 'Jane', 'Doevenport', '2026-09-10 09:00:00', '2026-01-01 00:00:00'],
		['oskar.kowalczyk@acme-robotics.example', 'Oskar', 'Kowalczyk', '2026-09-11 09:00:00', '2026-01-02 00:00:00'],
		['li.wei@zephyr-advisory.example', 'Liwei', 'Zhangsun', '2026-07-01 09:00:00', '2026-01-03 00:00:00'],
		['amara.okafor@zephyr-advisory.example', 'Amara', 'Okafordottir', null, '2026-01-04 00:00:00']
	];
	const users: string[] = [];
	for (const [email, first, last, login, createdAt] of people) {
		const id = randomUUID();
		users.push(id);
		await insert(dataSource, d, 'user', {
			id,
			tenantId: acme,
			email: seed(email),
			firstName: seed(first),
			lastName: seed(last),
			lastLoginAt: login,
			isActive: true,
			emailVerifiedAt: createdAt,
			createdAt
		});
	}
	await add('user', { tenantId: zephyr, email: 'deleted@zephyr-advisory.example', firstName: 'Gone', lastName: 'User', deletedAt: '2026-09-01 00:00:00' });
	await add('employee', { tenantId: acme, isActive: true, isArchived: false });
	await add('employee', { tenantId: acme, isActive: true, isArchived: false });
	await add('employee', { tenantId: zephyr, isActive: false, isArchived: false });
	await add('employee', { tenantId: zephyr, isActive: true, deletedAt: '2026-09-01 00:00:00' });
	await add('organization_team', { tenantId: acme, name: seed('Firmware Wizards') });
	await add('organization_team', { tenantId: zephyr, name: seed('Tax Strategy Desk') });
	for (const title of ['Calibrate gripper arm', 'Audit Globex ledger', 'Draft Initech proposal', 'Fix Umbrella login']) {
		await add('task', { tenantId: acme, title: seed(title) });
	}
	await add('task', { tenantId: zephyr, title: seed('Renew Wonka contract') });
	await add('organization_project', { tenantId: acme, name: seed('Project Hyperion Gripper') });
	await add('organization_project', { tenantId: zephyr, name: seed('Globex Restructuring 2026') });
	const contacts: Array<[string, string, string, string]> = [
		[acme, 'Globex Corporation', 'billing@globex-corp.example', '742 Evergreen Terrace, Springfield'],
		[acme, 'Initech Systems', 'ap@initech-systems.example', '4120 Freidrich Lane, Austin'],
		[zephyr, 'Umbrella Pharma', 'finance@umbrella-pharma.example', '1 Raccoon Plaza, Raccoon City']
	];
	for (const [tenantId, name, email, address] of contacts) {
		await add('organization_contact', { tenantId, name: seed(name), primaryEmail: seed(email), address: seed(address) });
	}
	await add('integration_tenant', { tenantId: acme, name: 'Github', isActive: true });
	await add('integration_tenant', { tenantId: zephyr, name: 'Github', isActive: true });
	await add('integration_tenant', { tenantId: acme, name: 'Upwork', isActive: true });
	await add('integration_tenant', { tenantId: acme, name: 'Upwork', isActive: true });
	await add('integration_tenant', { tenantId: acme, name: 'Jira', isActive: false });
	await add('integration_tenant', { tenantId: acme, name: seed('Acme_Private_Connector'), isActive: true });
	const invoice = (tenantId: string, currency: string | null, totalValue: number, invoiceDate: string, extra: Record<string, unknown> = {}) =>
		add('invoice', { tenantId, invoiceNumber: seed(`INV-CANARY-${seeded.length}`), currency, totalValue, isEstimate: false, invoiceDate, ...extra });
	await invoice(acme, 'EUR', 100.5, '2026-09-01 00:00:00');
	await invoice(acme, 'EUR', 200.25, '2026-09-30 23:59:59');
	await invoice(zephyr, 'USD', 1000, '2026-09-15 12:00:00');
	await invoice(acme, 'JPY', 5000, '2026-09-15 12:00:00');
	await invoice(acme, 'KWD', 1.2345, '2026-09-15 12:00:00');
	await invoice(acme, 'eur', 10, '2026-09-15 12:00:00');
	await invoice(acme, null, 5, '2026-09-15 12:00:00');
	await invoice(acme, 'EUR', 999, '2026-09-15 12:00:00', { isEstimate: true });
	await invoice(acme, 'EUR', 50, '2026-08-31 23:59:59');
	await invoice(acme, 'EUR', 70, '2026-09-10 12:00:00', { deletedAt: '2026-09-11 00:00:00' });
	await invoice(acme, 'EUR', 80, '2026-10-01 00:00:00');
	await add('payment', { tenantId: acme, note: seed('Paid by Globex via wire 4471'), currency: 'EUR', amount: 100, paymentDate: '2026-09-05 10:00:00' });
	await add('payment', { tenantId: acme, note: seed('Refund Initech overcharge'), currency: 'EUR', amount: -20, paymentDate: '2026-09-06 10:00:00' });
	await add('payment', { tenantId: zephyr, note: seed('Umbrella retainer'), currency: 'USD', amount: 5.5, paymentDate: '2026-09-07 10:00:00' });
	await add('payment', { tenantId: zephyr, note: 'August', currency: 'USD', amount: 9, paymentDate: '2026-08-07 10:00:00' });
	await add('time_log', { tenantId: acme, description: seed('Pairing with Jane on gripper'), startedAt: '2026-09-03 08:00:00', stoppedAt: '2026-09-03 10:00:00' });
	await add('time_log', { tenantId: zephyr, description: seed('Globex ledger review'), startedAt: '2026-09-04 08:00:00', stoppedAt: '2026-09-04 08:30:00' });
	await add('time_log', { tenantId: acme, description: 'still running', startedAt: '2026-09-05 08:00:00', stoppedAt: null });
	await add('time_log', { tenantId: acme, description: 'august', startedAt: '2026-08-05 08:00:00', stoppedAt: '2026-08-05 09:00:00' });
	await add('time_log', { tenantId: acme, description: 'negative', startedAt: '2026-09-06 09:00:00', stoppedAt: '2026-09-06 08:00:00' });
	return { seeded, acme, zephyr, users };
}

/** The instance-wide numbers of the canary database for September 2026, counted on 2026-09-20. */
export const CANARY_GOLDEN = Object.freeze({
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
	aggregates: {
		invoiced_minor: { EUR: 30075, JPY: 5000, KWD: 1235, USD: 100000 },
		invoices: 7,
		payments_minor: { EUR: 8000, USD: 550 },
		payments: 3,
		hours_tracked_min: 150
	}
});

/** The day the golden numbers are counted on (it decides who signed in within 30 days). */
export const CANARY_NOW = new Date(Date.UTC(2026, 8, 20, 12));

/** The seeded values found in `text`. */
export function canaryLeaks(seeded: string[], text: string): string[] {
	return seeded.filter((value) => text.includes(value));
}
