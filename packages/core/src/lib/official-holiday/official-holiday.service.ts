import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
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
 * Only `findAllByFilter()`, `findOneByIdString()`, `update()` and `delete()` narrow further than that:
 * every other inherited read and write stops at the tenant, which holds many organizations. A new route
 * has to go through one of those four, or make the membership check itself.
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
	 * The organization a stored holiday belongs to, once the caller is confirmed to be a member of it.
	 *
	 * The by-id routes name no organization, so there is nothing for a request DTO to validate and the
	 * inherited CRUD methods scope to the tenant and stop there — but a tenant holds many organizations.
	 * A holder of the Time Off policy permissions could therefore pass the id of a sibling organization's
	 * holiday and read or write the row the listing would have refused them. The organization has to come
	 * from the STORED row instead, and the caller is checked against that one. That is also what stops a
	 * PUT body from moving a foreign holiday into the caller's own organization: the request names the
	 * organization it WANTS, which proves nothing about the one the row lives in.
	 *
	 * Unlike the inherited tenant scoping — which is skipped entirely when there is no request context —
	 * this check fails CLOSED: these routes are HTTP-only, and a background caller must not inherit a
	 * silently unscoped read.
	 *
	 * @param holiday the stored holiday the request named
	 * @returns the organization the caller was authorized against, to pin onto any write that follows
	 * @throws ForbiddenException when the holiday belongs to no organization, or the caller is not a member
	 */
	private async authorizedOrganizationOf(holiday: OfficialHoliday): Promise<ID> {
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

		return organizationId;
	}

	/**
	 * Read one official holiday, refusing one that belongs to another organization of the tenant.
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

		await this.authorizedOrganizationOf(holiday);

		return holiday;
	}

	/**
	 * Update one official holiday, refusing one that belongs to another organization of the tenant.
	 *
	 * The membership check is an unlocked read, and `CrudService.update()` writes by RAW id — no tenant
	 * predicate, let alone an organization one. A holiday re-parented between the two would therefore be
	 * written by a caller who no longer has any claim on it. Naming the authorized organization in the
	 * criteria closes that: `TenantAwareCrudService.update()` resolves an object criteria through
	 * `findOneByWhereOptions()`, which 404s when nothing matches, and the same predicate then lands in the
	 * UPDATE's own WHERE, so a row that moves after that read is simply not matched.
	 *
	 * @param id the holiday to update
	 * @param partialEntity the fields to change
	 * @returns the update result
	 * @throws NotFoundException when no holiday of the caller's tenant has that id, or it moved meanwhile
	 * @throws ForbiddenException when the caller is not a member of the holiday's organization
	 */
	async update(
		id: ID,
		partialEntity: QueryDeepPartialEntity<OfficialHoliday>
	): Promise<OfficialHoliday | UpdateResult> {
		const organizationId = await this.authorizedOrganizationOf(await super.findOneByIdString(id));
		const criteria = { id, organizationId } as FindOptionsWhere<OfficialHoliday>;

		const result = await super.update(criteria, partialEntity);

		// A zero count cannot be read as "it moved" on its own: MySQL reports rows CHANGED rather than rows
		// matched, so a PUT that writes the values the row already holds reports zero as well. Ask instead —
		// this only costs a query in the zero case, and `findOneByWhereOptions()` raises the 404 itself.
		if (result && 'affected' in result && result.affected === 0) {
			await this.findOneByWhereOptions(criteria);
		}

		return result;
	}

	/**
	 * Delete one official holiday, refusing one that belongs to another organization of the tenant.
	 *
	 * `TenantAwareCrudService.delete()` merges the tenant conditions straight into the criteria and never
	 * reads the row, so it carries no organization check of its own. Resolve the holiday first, then pin
	 * the authorized organization onto the DELETE as well — the same race {@link update} guards against —
	 * and treat a zero-row result as "not yours any more" rather than reporting a successful no-op.
	 *
	 * @param id the holiday to delete
	 * @returns the delete result
	 * @throws NotFoundException when no holiday of the caller's tenant has that id, or it moved meanwhile
	 * @throws ForbiddenException when the caller is not a member of the holiday's organization
	 */
	async delete(id: ID): Promise<DeleteResult> {
		const organizationId = await this.authorizedOrganizationOf(await super.findOneByIdString(id));

		const result = await super.delete(id, {
			where: { organizationId } as FindOptionsWhere<OfficialHoliday>
		});

		// Only an explicit zero: a driver that reports no count at all must not turn a real delete into a 404.
		if (result?.affected === 0) {
			throw new NotFoundException('The requested record was not found');
		}

		return result;
	}
}
