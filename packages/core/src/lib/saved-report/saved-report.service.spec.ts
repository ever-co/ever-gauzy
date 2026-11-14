import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavedReportKindEnum, SavedReportPeriodRuleEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { SavedReportService, savedReportView } from './saved-report.service';
import { hashSavedReportToken, isWellFormedSavedReportToken } from './saved-report-token';

const TENANT = 'b0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000002';
const MARIE = 'b0000000-0000-4000-8000-0000000000a1';
const PAUL = 'b0000000-0000-4000-8000-0000000000a2';
const REPORT = 'b0000000-0000-4000-8000-000000000003';

type Row = Record<string, unknown>;

/** The service over an in-memory table, with the caller set to `caller`. */
function serviceFor(caller: string) {
	const rows: Row[] = [
		{
			id: REPORT,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			authorId: MARIE,
			name: 'Client A, last month',
			kind: SavedReportKindEnum.TIME_AND_ACTIVITY,
			periodRule: SavedReportPeriodRuleEnum.LAST_MONTH,
			shareTokenHash: null,
			sharedAt: null,
			shareExpiresAt: null,
			includeAmounts: false
		}
	];
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(caller);
	const service = new SavedReportService({} as never, {} as never);
	const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
	jest.spyOn(service, 'find').mockImplementation(
		async (options: unknown) => rows.filter((row) => matches(row, (options as { where: Row }).where)) as never
	);
	jest.spyOn(service, 'create').mockImplementation(async (entity: unknown) => {
		const row = { id: 'new-report', tenantId: TENANT, ...(entity as Row) };
		rows.push(row);
		return row as never;
	});
	jest.spyOn(service, 'update').mockImplementation(async (criteria: unknown, changes: unknown) => {
		rows.filter((row) => matches(row, criteria as Row)).forEach((row) => Object.assign(row, changes));
		return {} as never;
	});
	jest.spyOn(service, 'delete').mockImplementation(async (criteria: unknown) => {
		const kept = rows.filter((row) => !matches(row, criteria as Row));
		const affected = rows.length - kept.length;
		rows.splice(0, rows.length, ...kept);
		return { affected, raw: [] } as never;
	});
	return { service, rows };
}

describe('SavedReportService', () => {
	afterEach(() => jest.restoreAllMocks());

	it("saves a report for the caller, with today's settings and no link", async () => {
		const { service, rows } = serviceFor(MARIE);

		const saved = await service.createOwn({
			organizationId: ORGANIZATION,
			name: 'Client A, last month',
			periodRule: SavedReportPeriodRuleEnum.LAST_MONTH,
			timeZone: 'Africa/Kinshasa',
			filters: { clientIds: ['c0000000-0000-4000-8000-000000000001'] }
		} as never);

		expect(rows[1]).toMatchObject({
			authorId: MARIE,
			organizationId: ORGANIZATION,
			kind: SavedReportKindEnum.TIME_AND_ACTIVITY,
			includeAmounts: false,
			shareTokenHash: null,
			startDate: null,
			endDate: null
		});
		expect(saved.isShared).toBe(false);
	});

	it('refuses a period that is both a rule and days, or neither', async () => {
		const { service } = serviceFor(MARIE);

		await expect(
			service.createOwn({
				organizationId: ORGANIZATION,
				name: 'Both',
				periodRule: SavedReportPeriodRuleEnum.LAST_MONTH,
				startDate: '2026-10-01',
				endDate: '2026-10-31'
			} as never)
		).rejects.toThrow(BadRequestException);
		await expect(service.createOwn({ organizationId: ORGANIZATION, name: 'Neither' } as never)).rejects.toThrow(
			BadRequestException
		);
	});

	it("answers 404 to Paul for Marie's report, on every route", async () => {
		const { service, rows } = serviceFor(PAUL);

		await expect(service.findOwn(REPORT)).rejects.toThrow(NotFoundException);
		await expect(service.updateOwn(REPORT, { name: 'Mine now' } as never)).rejects.toThrow(NotFoundException);
		await expect(service.shareOwn(REPORT, {})).rejects.toThrow(NotFoundException);
		await expect(service.unshareOwn(REPORT)).rejects.toThrow(NotFoundException);
		await expect(service.deleteOwn(REPORT)).rejects.toThrow(NotFoundException);
		expect(rows[0]).toMatchObject({ name: 'Client A, last month', shareTokenHash: null });
		expect(await service.listOwn(ORGANIZATION)).toEqual({ items: [], total: 0 });
	});

	it('turns a link on with a token shown once, stores only its digest, and replaces it with a new one', async () => {
		const { service, rows } = serviceFor(MARIE);

		const first = await service.shareOwn(REPORT, { expiresAt: '2027-01-01T00:00:00.000Z' });
		const firstDigest = rows[0].shareTokenHash;

		expect(isWellFormedSavedReportToken(first.token)).toBe(true);
		expect(firstDigest).toBe(hashSavedReportToken(first.token));
		expect(JSON.stringify(rows[0])).not.toContain(first.token);
		expect(rows[0].shareExpiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));

		const second = await service.shareOwn(REPORT, {});

		expect(second.token).not.toBe(first.token);
		expect(rows[0].shareTokenHash).toBe(hashSavedReportToken(second.token));
		expect(rows[0].shareTokenHash).not.toBe(firstDigest);
		expect(rows[0].shareExpiresAt).toBeNull();
	});

	it('refuses a link end date in the past', async () => {
		const { service, rows } = serviceFor(MARIE);

		await expect(service.shareOwn(REPORT, { expiresAt: '2020-01-01T00:00:00.000Z' })).rejects.toThrow(
			BadRequestException
		);
		expect(rows[0].shareTokenHash).toBeNull();
	});

	it('turns the link off by clearing its digest', async () => {
		const { service, rows } = serviceFor(MARIE);
		await service.shareOwn(REPORT, {});

		await service.unshareOwn(REPORT);

		expect(rows[0]).toMatchObject({ shareTokenHash: null, sharedAt: null, shareExpiresAt: null });
		expect((await service.findOwn(REPORT)).isShared).toBe(false);
	});

	it('refuses to clear the name, the report kind or the amounts choice, with a 400 instead of a database error', async () => {
		const { service, rows } = serviceFor(MARIE);

		for (const cleared of [{ name: null }, { kind: null }, { includeAmounts: null }]) {
			await expect(service.updateOwn(REPORT, cleared as never)).rejects.toThrow(BadRequestException);
		}
		expect(rows[0]).toMatchObject({
			name: 'Client A, last month',
			kind: SavedReportKindEnum.TIME_AND_ACTIVITY,
			includeAmounts: false
		});
	});

	it('switches a report from a rule to fixed days when the update clears the rule', async () => {
		const { service, rows } = serviceFor(MARIE);

		await service.updateOwn(REPORT, { periodRule: null, startDate: '2026-10-01', endDate: '2026-10-31' } as never);

		expect(rows[0]).toMatchObject({ periodRule: null, startDate: '2026-10-01', endDate: '2026-10-31' });
	});
});

describe('savedReportView', () => {
	it('never states the digest of the link, and says whether the link works now', () => {
		const view = savedReportView(
			{ id: REPORT, authorId: MARIE, shareTokenHash: 'a'.repeat(64), shareExpiresAt: null } as never,
			new Date()
		);

		expect(JSON.stringify(view)).not.toContain('a'.repeat(64));
		expect(view).not.toHaveProperty('shareTokenHash');
		expect(view.isShared).toBe(true);
	});
});
