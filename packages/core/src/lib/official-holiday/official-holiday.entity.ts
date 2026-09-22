import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { IOfficialHoliday } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOfficialHolidayRepository } from './repository/mikro-orm-official-holiday.repository';

/**
 * A publicly recognized holiday for a country, kept per organization.
 *
 * Issue #314 asks for an `OfficialHolidays` table so the "Add Holidays" dialog can offer a
 * predefined list of national holidays and pre-fill the From/To dates once one is picked,
 * filtered by the organization's country setting.
 *
 * Dates are stored as `date`, not as timestamps: a public holiday is a calendar day, and storing
 * it with a time component makes it land on the wrong day for anybody in another timezone.
 */
@ColumnIndex('IDX_official_holiday_unique', ['tenantId', 'organizationId', 'countryCode', 'date', 'name'], {
	unique: true
})
@MultiORMEntity('official_holiday', { mikroOrmRepository: () => MikroOrmOfficialHolidayRepository })
export class OfficialHoliday extends TenantOrganizationBaseEntity implements IOfficialHoliday {
	@ApiProperty({ type: () => String, description: 'Display name of the holiday, e.g. "Christmas Day"' })
	@IsNotEmpty()
	@IsString()
	@Length(2, 200)
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String, description: 'ISO 3166-1 alpha-2 country code, e.g. "US", "DE"' })
	@IsNotEmpty()
	@IsString()
	@Length(2, 2)
	@ColumnIndex()
	@MultiORMColumn({ length: 2 })
	countryCode: string;

	@ApiProperty({ type: () => Date, description: 'The holiday date, or the first day of a multi-day holiday' })
	@IsNotEmpty()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'date' })
	date: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'Last day of a multi-day holiday' })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ type: 'date', nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether the holiday falls on the same date every year' })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: true })
	isRecurring?: boolean;
}
