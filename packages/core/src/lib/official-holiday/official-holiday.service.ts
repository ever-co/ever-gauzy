import { ForbiddenException, Injectable } from '@nestjs/common';
import { Between, DeleteResult } from 'typeorm';
import { ID, IOfficialHoliday, IOfficialHolidayFindInput, IPagination } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { LegacyFindOneOptions } from './../core/utils';
import { assertCurrentUserBelongsToOrganization } from './../user-organization/assert-organization-membership';
import { OfficialHoliday } from './official-holiday.entity';
import { MikroOrmOfficialHolidayRepository } from './repository/mikro-orm-official-holiday.repository';
import { TypeOrmOfficialHolidayRepository } from './repository/type-orm-official-holiday.repository';

/**
 * Official holidays per country, used to pre-fill the "Add Holidays" dialog (issue #314).
 *
 * `TenantAwareCrudService` already forces `tenantId` onto every read and write, so the extra
 * filters below only narrow within the caller's own tenant.
 *
 * Only `findAllByFilter()`, `findOneByIdString()` and `delete()` narrow further than that: every other
 * inherited read and write stops at the tenant, which holds many organizations. A new route has to go
 * through one of those three, or make the membership check itself.
 */
@Injectable()
export class OfficialHolidayService extends TenantAwareCrudService<OfficialHoliday> {
	constructor(
		readonly typeOrmOfficialHolidayRepository: TypeOrmOfficialHolidayRepository,
		readonly mikroOrmOfficialHolidayRepository: MikroOrmOfficialHolidayRepository
	) {
		super(typeOrmOfficialHolidayRepository, mikroOrmOfficialHolidayRepository);
	}

	/**
	 * List the official holidays of an organization, optionally narrowed to a country and a year.
	 *
	 * @param input the country code and/or calendar year to filter by
	 * @returns the matching holidays, earliest first
	 */
	async findAllByFilter(input: IOfficialHolidayFindInput): Promise<IPagination<IOfficialHoliday>> {
		const { countryCode, year, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// This reads through the raw repository, so the organization is not injected for us, and an
		// undefined key is DROPPED from a TypeORM where object rather than matching nothing — the
		// listing would silently widen to every organization of the tenant. The query DTO does not
		// close this on its own: `sentTo` suppresses the conditional `organizationId` presence AND
		// membership validation it inherits, so both are enforced here. Fail closed.
		await assertCurrentUserBelongsToOrganization(this.typeOrmRepository.manager, organizationId);

		const base: Record<string, unknown> = { tenantId, organizationId };

		if (countryCode) {
			base['countryCode'] = countryCode.toUpperCase();
		}

		// A recurring holiday is stored once, against whatever year it was entered for, so a plain
		// date range would hide it from every other year. Match "falls in this year" OR "recurs".
		// `date` is a calendar date column, so a YYYY-MM-DD range is exact and needs no timezone
		// handling.
		const where = year
			? [
					{ ...base, date: Between(`${year}-01-01`, `${year}-12-31`) },
					{ ...base, isRecurring: true }
				]
			: base;

		const [items, total] = await this.typeOrmRepository.findAndCount({
			where: where as any,
			order: { date: 'ASC' }
		});

		return { items, total };
	}

	/**
	 * Read one official holiday, refusing one that belongs to another organization of the tenant.
	 *
	 * The by-id routes name no organization, so there is nothing for a request DTO to validate and the
	 * inherited CRUD methods scope to the tenant and stop there — but a tenant holds many organizations.
	 * A holder of the Time Off policy permissions could therefore pass the id of a sibling organization's
	 * holiday and read the row the listing would have refused them. The organization has to come from the
	 * STORED row instead, and the caller is checked against that one.
	 *
	 * `TenantAwareCrudService.update()` resolves its row through this method before it writes, so the
	 * update route is covered by the same check and must not repeat it; `delete()` never reads the row
	 * at all, hence the override below. Taking the organization off the STORED row is also what stops a
	 * PUT body from moving a foreign holiday into the caller's own organization: the request names the
	 * organization it WANTS, which proves nothing about the one the row lives in.
	 *
	 * Unlike the inherited tenant scoping — which is skipped entirely when there is no request context —
	 * this check fails CLOSED: these routes are HTTP-only, and a background caller must not inherit a
	 * silently unscoped read.
	 *
	 * @param id the holiday to read
	 * @param options additional find options
	 * @returns the holiday
	 * @throws NotFoundException when no holiday of the caller's tenant has that id
	 * @throws ForbiddenException when the caller is not a member of the holiday's organization
	 */
	async findOneByIdString(id: ID, options?: LegacyFindOneOptions<OfficialHoliday>): Promise<OfficialHoliday> {
		// Throws NotFoundException when the id names no row of the caller's tenant, so the row below is real.
		const holiday = await super.findOneByIdString(id, options);

		// `organizationId` is a relation-id mirror, which MikroORM maps to `persist: false` and does not
		// always hydrate, so read the relation as a fallback before deciding — the same shape the
		// organization-scoped validators use.
		const organizationId = holiday.organizationId || holiday.organization?.id;

		// The column is nullable on every tenant-organization entity and the membership lookup cannot reach
		// a verdict without it, so an orphaned or legacy holiday must not become manageable by everybody in
		// the tenant. Refuse here rather than fall through to the helper's "required" 400: the request is
		// well formed, it is the stored row that belongs to no organization.
		if (!organizationId) {
			throw new ForbiddenException('You are not a member of this organization');
		}

		await assertCurrentUserBelongsToOrganization(this.typeOrmRepository.manager, organizationId);

		return holiday;
	}

	/**
	 * Delete one official holiday, refusing one that belongs to another organization of the tenant.
	 *
	 * `TenantAwareCrudService.delete()` merges the tenant conditions straight into the criteria and never
	 * reads the row, so — unlike `update()` — it inherits no organization check from
	 * {@link findOneByIdString}. Resolve the holiday through it first.
	 *
	 * @param id the holiday to delete
	 * @returns the delete result
	 * @throws NotFoundException when no holiday of the caller's tenant has that id
	 * @throws ForbiddenException when the caller is not a member of the holiday's organization
	 */
	async delete(id: ID): Promise<DeleteResult> {
		await this.findOneByIdString(id);

		return super.delete(id);
	}
}
