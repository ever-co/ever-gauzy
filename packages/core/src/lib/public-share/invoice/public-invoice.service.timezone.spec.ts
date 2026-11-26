import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { signPurposeToken, TokenPurposeEnum } from '../../auth/purpose-token';
import { coreEntities } from '../../core/entities';
import { EstimateEmail, Invoice } from '../../core/entities/internal';
import { formatInvoiceDay } from '../../invoice/invoice-date.util';
import { PublicInvoiceQueryDTO, PublicInvoiceRelationEnum } from './dto';
import { PublicInvoiceService } from './public-invoice.service';

/**
 * Regression suite for ever-co/ever-gauzy#12136 — public invoice organization time zone.
 *
 * Runs `PublicInvoiceService.findOneByConditions` against a real better-sqlite3 database with
 * TypeORM's actual `Invoice` and `Organization` schemas so the repository's `select` projection
 * and relation loading are exercised end-to-end (not mocked or stripped).
 */

const TIMEOUT = 5 * 60 * 1000;

const TENANT = '12136000-0000-4000-8000-000000000001';
const ORG_BERLIN = '12136000-0000-4000-8000-000000000010';
const ORG_NEW_YORK = '12136000-0000-4000-8000-000000000011';
const ORG_NO_TZ = '12136000-0000-4000-8000-000000000012';
const CONTACT = '12136000-0000-4000-8000-000000000020';

interface PublicOrganizationFixture {
	name: string;
	officialName: string;
	brandColor: string;
	timeZone: string | null;
}

const BERLIN_ORG: PublicOrganizationFixture = {
	name: 'Berlin Studio',
	officialName: 'Berlin Studio GmbH',
	brandColor: '#112233',
	timeZone: 'Europe/Berlin'
};
const NEW_YORK_ORG: PublicOrganizationFixture = {
	name: 'New York Branch',
	officialName: 'New York Branch LLC',
	brandColor: '#abcdef',
	timeZone: 'America/New_York'
};
const NO_TZ_ORG: PublicOrganizationFixture = {
	name: 'No Zone Org',
	officialName: 'No Zone Org Inc.',
	brandColor: '#445566',
	timeZone: null
};

// `image` is an existing `eager: true` relation on `Organization`; the four scalar columns come from `select`.
const ALLOWED_ORG_KEYS = ['brandColor', 'image', 'name', 'officialName', 'timeZone'];
const DISALLOWED_ORG_KEYS = [
	'taxId',
	'dateFormat',
	'currency',
	'profile_link',
	'overview',
	'banner',
	'defaultBillRateValue',
	'tenantId',
	'invitesAllowed',
	'bonusPercentage'
];

interface SerializedPublicInvoice {
	fromOrganization?: Record<string, unknown>;
	organization?: Record<string, unknown>;
	toContact?: Record<string, unknown>;
	internalNote?: unknown;
}

const expectedOrganization = (fixture: PublicOrganizationFixture) => ({ ...fixture, image: null });

const shareToken = (id: string, organizationId: string, tenantId = TENANT): string =>
	signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, { id, organizationId, tenantId });

const expectStrictOrganizationProjection = (
	org: Record<string, unknown> | undefined,
	fixture: PublicOrganizationFixture
): void => {
	expect(org).toEqual(expectedOrganization(fixture));
	expect(Object.keys(org).sort()).toEqual(ALLOWED_ORG_KEYS);
	for (const forbiddenKey of DISALLOWED_ORG_KEYS) {
		expect(org).not.toHaveProperty(forbiddenKey);
	}
};

describe('PublicInvoiceService.findOneByConditions — organization timeZone projection (#12136)', () => {
	let dataSource: DataSource;
	let service: PublicInvoiceService;

	/** Inserts a row with the given columns and fills remaining NOT NULL columns without defaults. */
	const insert = async (table: string, row: Record<string, unknown>): Promise<void> => {
		const columns: Array<{ name: string; type: string; notnull: number; dflt_value: unknown; pk: number }> =
			await dataSource.query(`PRAGMA table_info("${table}")`);
		const values: Record<string, unknown> = { ...row };
		for (const column of columns) {
			if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) {
				continue;
			}
			const type = String(column.type).toLowerCase();
			if (/int|bool|numeric|decimal|real|float/.test(type)) {
				values[column.name] = 0;
			} else if (/date|time/.test(type)) {
				values[column.name] = '2026-01-01 00:00:00';
			} else {
				values[column.name] = 'x';
			}
		}
		const keys = Object.keys(values);
		const names = keys.map((key) => `"${key}"`).join(', ');
		const placeholders = keys.map(() => '?').join(', ');
		await dataSource.query(
			`INSERT INTO "${table}" (${names}) VALUES (${placeholders})`,
			keys.map((key) => values[key])
		);
	};

	const seedOrganization = async (id: string, fields: PublicOrganizationFixture): Promise<void> => {
		await insert('organization', {
			id,
			tenantId: TENANT,
			currency: 'EUR',
			taxId: 'DE-999999999',
			dateFormat: 'DD.MM.YYYY',
			profile_link: `profile-${id}`,
			overview: 'Private internal overview',
			banner: 'https://example.test/banner.png',
			defaultBillRateValue: 150,
			invitesAllowed: 1,
			bonusPercentage: 15,
			...fields
		});
	};

	const seedInvoice = async (
		id: string,
		fields: {
			invoiceNumber: number;
			fromOrganizationId: string;
			organizationId: string;
			status?: string;
		}
	): Promise<string> => {
		const token = shareToken(id, fields.organizationId);
		await insert('invoice', {
			id,
			tenantId: TENANT,
			invoiceNumber: fields.invoiceNumber,
			fromOrganizationId: fields.fromOrganizationId,
			organizationId: fields.organizationId,
			toContactId: CONTACT,
			currency: 'EUR',
			discountValue: 0,
			tax: 0,
			tax2: 0,
			terms: 'Net 30',
			totalValue: 500,
			amountDue: 500,
			alreadyPaid: 0,
			paid: 0,
			isEstimate: 0,
			status: fields.status ?? 'VIEWED',
			invoiceDate: '2026-11-21 23:00:00.000',
			dueDate: '2026-12-22 22:59:59.999',
			internalNote: 'Internal margin note - never serve publicly',
			token
		});
		return token;
	};

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();

		for (const table of ['organization_contact', 'organization']) {
			const columns: Array<{ name: string }> = await dataSource.query(`PRAGMA table_info("${table}")`);
			if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
				await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
			}
		}

		service = new PublicInvoiceService(
			dataSource.getRepository(Invoice) as never,
			dataSource.getRepository(EstimateEmail)
		);
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await dataSource.query('PRAGMA foreign_keys = OFF');
		for (const table of ['invoice_item', 'invoice', 'organization_contact', 'organization', 'tenant']) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}

		await insert('tenant', { id: TENANT, name: 'Test Tenant', logo: 'https://example.test/logo.png' });
		await seedOrganization(ORG_BERLIN, BERLIN_ORG);
		await seedOrganization(ORG_NEW_YORK, NEW_YORK_ORG);
		await seedOrganization(ORG_NO_TZ, NO_TZ_ORG);
		await insert('organization_contact', {
			id: CONTACT,
			tenantId: TENANT,
			organizationId: ORG_BERLIN,
			name: 'Lantern Press',
			contactType: 'CLIENT',
			imageUrl: 'https://example.test/client.png',
			primaryEmail: 'billing@lantern.test',
			primaryPhone: '+1-555-0100',
			notes: 'Private client notes'
		});
	});

	it('includes timeZone on fromOrganization and organization alongside existing fields without leaking extra organization columns', async () => {
		const invoiceId = '12136000-0000-4000-8000-000000000101';
		const token = await seedInvoice(invoiceId, {
			invoiceNumber: 101,
			fromOrganizationId: ORG_BERLIN,
			organizationId: ORG_BERLIN
		});

		const raw = await service.findOneByConditions({ id: invoiceId, token }, [
			'fromOrganization',
			'organization',
			'toContact',
			'invoiceItems'
		]);
		const serialized = instanceToPlain(raw) as SerializedPublicInvoice;

		expectStrictOrganizationProjection(serialized.fromOrganization, BERLIN_ORG);
		expectStrictOrganizationProjection(serialized.organization, BERLIN_ORG);

		// Existing non-organization fields and protections stay intact (`image` is OrganizationContact's eager relation).
		expect(serialized.toContact).toEqual({
			id: CONTACT,
			contactType: 'CLIENT',
			image: null,
			imageUrl: 'https://example.test/client.png',
			name: 'Lantern Press'
		});
		expect(serialized.toContact).not.toHaveProperty('primaryEmail');
		expect(serialized.toContact).not.toHaveProperty('notes');
		expect(serialized).not.toHaveProperty('internalNote');

		// The served timeZone matches the calendar days rendered by the invoice PDF helper.
		expect(formatInvoiceDay(new Date('2026-11-21T23:00:00.000Z'), raw.fromOrganization)).toBe('2026-11-22');
		expect(formatInvoiceDay(new Date('2026-12-22T22:59:59.999Z'), raw.fromOrganization)).toBe('2026-12-22');
	});

	it('returns the issuing organization timeZone on fromOrganization even when organization differs or only fromOrganization is requested', async () => {
		const invoiceId = '12136000-0000-4000-8000-000000000102';
		const token = await seedInvoice(invoiceId, {
			invoiceNumber: 102,
			fromOrganizationId: ORG_BERLIN,
			organizationId: ORG_NEW_YORK
		});

		const both = instanceToPlain(
			await service.findOneByConditions({ id: invoiceId, token }, ['fromOrganization', 'organization'])
		) as SerializedPublicInvoice;

		expectStrictOrganizationProjection(both.fromOrganization, BERLIN_ORG);
		expectStrictOrganizationProjection(both.organization, NEW_YORK_ORG);

		const issuingOnly = instanceToPlain(
			await service.findOneByConditions({ id: invoiceId, token }, ['fromOrganization'])
		) as SerializedPublicInvoice;

		expectStrictOrganizationProjection(issuingOnly.fromOrganization, BERLIN_ORG);
		expect(issuingOnly.organization).toBeUndefined();
	});

	it('handles an organization without a configured timeZone without error or extra fields', async () => {
		const invoiceId = '12136000-0000-4000-8000-000000000103';
		const token = await seedInvoice(invoiceId, {
			invoiceNumber: 103,
			fromOrganizationId: ORG_NO_TZ,
			organizationId: ORG_NO_TZ
		});

		const serialized = instanceToPlain(
			await service.findOneByConditions({ id: invoiceId, token }, ['fromOrganization', 'organization'])
		) as SerializedPublicInvoice;

		expectStrictOrganizationProjection(serialized.fromOrganization, NO_TZ_ORG);
		expectStrictOrganizationProjection(serialized.organization, NO_TZ_ORG);
	});

	it('preserves markViewed, empty relations behavior, void refusal, and share-token enforcement', async () => {
		const sentId = '12136000-0000-4000-8000-000000000104';
		const sentToken = await seedInvoice(sentId, {
			invoiceNumber: 104,
			fromOrganizationId: ORG_BERLIN,
			organizationId: ORG_BERLIN,
			status: 'SENT'
		});

		const viewed = await service.findOneByConditions({ id: sentId, token: sentToken }, ['fromOrganization']);
		expect(viewed.status).toBe('VIEWED');
		expect(viewed.fromOrganization?.name).toBe('Berlin Studio');
		expect(viewed).not.toHaveProperty('internalNote');

		const noRelations = await service.findOneByConditions({ id: sentId, token: sentToken }, []);
		expect(noRelations.fromOrganization).toBeUndefined();
		expect(noRelations.organization).toBeUndefined();
		expect(noRelations).not.toHaveProperty('internalNote');

		const voidId = '12136000-0000-4000-8000-000000000105';
		const voidToken = await seedInvoice(voidId, {
			invoiceNumber: 105,
			fromOrganizationId: ORG_BERLIN,
			organizationId: ORG_BERLIN,
			status: 'VOID'
		});

		await expect(
			service.findOneByConditions({ id: voidId, token: voidToken }, ['fromOrganization', 'organization'])
		).rejects.toBeInstanceOf(ForbiddenException);

		await expect(
			service.findOneByConditions({ id: sentId, token: voidToken }, ['fromOrganization', 'organization'])
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('preserves the PublicInvoiceQueryDTO relation allowlist', async () => {
		const allowed = plainToInstance(PublicInvoiceQueryDTO, {
			relations: 'fromOrganization,organization,toContact,invoiceItems'
		});
		expect(await validate(allowed)).toHaveLength(0);
		expect(allowed.relations).toEqual(['fromOrganization', 'organization', 'toContact', 'invoiceItems']);

		const disallowed = plainToInstance(PublicInvoiceQueryDTO, {
			relations: 'fromOrganization,payments'
		});
		expect(await validate(disallowed)).not.toHaveLength(0);

		expect(Object.values(PublicInvoiceRelationEnum).sort()).toEqual([
			'fromOrganization',
			'invoiceItems',
			'invoiceItems.employee',
			'invoiceItems.employee.user',
			'invoiceItems.expense',
			'invoiceItems.product',
			'invoiceItems.project',
			'invoiceItems.task',
			'organization',
			'tenant',
			'toContact'
		]);
	});
});
