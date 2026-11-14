import { ApiProperty, ApiPropertyOptional, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsTimeZone,
	IsUUID,
	Matches,
	MaxLength,
	ValidateNested
} from 'class-validator';
import {
	ID,
	ISavedReportCreateInput,
	ISavedReportFilters,
	ISavedReportShareInput,
	SAVED_REPORT_NO_CLIENT,
	SavedReportGroupingEnum,
	SavedReportKindEnum,
	SavedReportPeriodRuleEnum
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/** How many ids one filter holds at most. */
const MAX_FILTER_IDS = 200;

/** A day, `YYYY-MM-DD`. */
const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** A client id, or the value that keeps the time without a client. */
const CLIENT_FILTER_SHAPE = new RegExp(
	`^(${SAVED_REPORT_NO_CLIENT}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
	'i'
);

/** A sent string without its surrounding spaces; anything else as sent, for the validators to refuse. */
function trimmed({ value }: { value: unknown }): unknown {
	if (typeof value === 'string') {
		return value.trim();
	}
	return value;
}

/** The filters of a saved report: every list optional, none meaning no filter. */
export class SavedReportFiltersDTO implements ISavedReportFilters {
	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_FILTER_IDS)
	@IsUUID('all', { each: true })
	teamIds?: ID[];

	@ApiPropertyOptional({ type: () => String, isArray: true, description: 'Members, by employee id.' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_FILTER_IDS)
	@IsUUID('all', { each: true })
	employeeIds?: ID[];

	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_FILTER_IDS)
	@IsUUID('all', { each: true })
	projectIds?: ID[];

	@ApiPropertyOptional({
		type: () => String,
		isArray: true,
		description: `Clients, by id; "${SAVED_REPORT_NO_CLIENT}" keeps the time without a client.`
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_FILTER_IDS)
	@Matches(CLIENT_FILTER_SHAPE, { each: true })
	clientIds?: string[];

	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_FILTER_IDS)
	@IsUUID('all', { each: true })
	taskIds?: ID[];

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	billableOnly?: boolean;
}

/**
 * `POST /saved-reports`. The period is a rule or two fixed days, never both: the service refuses a body that states
 * neither, both, days in the wrong order or more than a year of days.
 */
export class CreateSavedReportDTO
	extends PickType(TenantOrganizationBaseDTO, ['tenantId', 'organizationId'] as const)
	implements ISavedReportCreateInput
{
	@ApiProperty({ type: () => String, maxLength: 100 })
	@Transform(trimmed)
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;

	@ApiPropertyOptional({ enum: SavedReportKindEnum, default: SavedReportKindEnum.TIME_AND_ACTIVITY })
	@IsOptional()
	@IsEnum(SavedReportKindEnum)
	kind?: SavedReportKindEnum;

	@ApiPropertyOptional({ enum: SavedReportPeriodRuleEnum })
	@IsOptional()
	@IsEnum(SavedReportPeriodRuleEnum)
	periodRule?: SavedReportPeriodRuleEnum | null;

	@ApiPropertyOptional({ type: () => String, example: '2026-10-01', description: 'First day of fixed dates.' })
	@IsOptional()
	@Matches(DAY_SHAPE)
	startDate?: string | null;

	@ApiPropertyOptional({
		type: () => String,
		example: '2026-10-31',
		description: 'Last day of fixed dates, included.'
	})
	@IsOptional()
	@Matches(DAY_SHAPE)
	endDate?: string | null;

	@ApiPropertyOptional({ type: () => String, example: 'Africa/Kinshasa' })
	@IsOptional()
	@IsString()
	@IsTimeZone()
	timeZone?: string | null;

	@ApiPropertyOptional({ type: () => SavedReportFiltersDTO })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => SavedReportFiltersDTO)
	filters?: SavedReportFiltersDTO | null;

	@ApiPropertyOptional({ enum: SavedReportGroupingEnum })
	@IsOptional()
	@IsEnum(SavedReportGroupingEnum)
	grouping?: SavedReportGroupingEnum | null;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	includeAmounts?: boolean;
}

/** `PUT /saved-reports/:id`: what is sent replaces what is stored; the organization never changes. */
export class UpdateSavedReportDTO extends PartialType(
	OmitType(CreateSavedReportDTO, ['tenantId', 'organizationId'] as const)
) {}

/** `POST /saved-reports/:id/share`: turns the link on, or replaces it. */
export class ShareSavedReportDTO implements ISavedReportShareInput {
	@ApiPropertyOptional({ type: () => String, description: 'When the link stops working; none for no end.' })
	@IsOptional()
	@IsDateString()
	expiresAt?: string | null;
}

/** `GET /saved-reports`: the caller's reports of one organization. */
export class SavedReportListQueryDTO extends PickType(TenantOrganizationBaseDTO, ['organizationId'] as const) {}
