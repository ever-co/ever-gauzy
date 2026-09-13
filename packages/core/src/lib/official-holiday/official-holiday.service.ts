import { Injectable } from '@nestjs/common';
import { Between } from 'typeorm';
import { IOfficialHoliday, IOfficialHolidayFindInput, IPagination } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { OfficialHoliday } from './official-holiday.entity';
import { MikroOrmOfficialHolidayRepository } from './repository/mikro-orm-official-holiday.repository';
import { TypeOrmOfficialHolidayRepository } from './repository/type-orm-official-holiday.repository';

/**
 * Official holidays per country, used to pre-fill the "Add Holidays" dialog (issue #314).
 *
 * `TenantAwareCrudService` already forces `tenantId` onto every read and write, so the extra
 * filters below only narrow within the caller's own tenant.
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
}
