import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import {
	ID,
	IInvoiceScheduleCreateInput,
	IInvoiceScheduleFindInput,
	IInvoiceScheduleUpdateInput,
	InvoiceScheduleFrequencyEnum,
	InvoiceScheduleGroupingEnum
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/** How many runs one read of a schedule's runs answers at most. */
export const MAX_INVOICE_SCHEDULE_RUNS_PER_PAGE = 50;

/** A day, `YYYY-MM-DD`. Whether it exists (2026-02-30 does not) is the service's check. */
const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** The organization every route acts in: the caller must belong to it. */
export class InvoiceScheduleScopeDTO extends PickType(TenantOrganizationBaseDTO, ['organizationId'] as const) {}

/** `POST /invoice-schedules`: a client's billing schedule. */
export class CreateInvoiceScheduleDTO
	extends PickType(TenantOrganizationBaseDTO, ['tenantId', 'organizationId'] as const)
	implements IInvoiceScheduleCreateInput
{
	@ApiProperty({ type: () => String, description: 'The client billed. A client has one schedule at most.' })
	@IsUUID()
	organizationContactId: ID;

	@ApiProperty({ enum: InvoiceScheduleFrequencyEnum })
	@IsEnum(InvoiceScheduleFrequencyEnum)
	frequency: InvoiceScheduleFrequencyEnum;

	@ApiProperty({
		type: () => String,
		example: '2026-10-01',
		description: "The first day of the first period, in the organization's time zone."
	})
	@Matches(DAY_SHAPE)
	startDay: string;

	@ApiPropertyOptional({ enum: InvoiceScheduleGroupingEnum, default: InvoiceScheduleGroupingEnum.PROJECT })
	@IsOptional()
	@IsEnum(InvoiceScheduleGroupingEnum)
	grouping?: InvoiceScheduleGroupingEnum;

	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description: 'Email each invoice to the client and mark it Sent; keep it as a draft otherwise.'
	})
	@IsOptional()
	@IsBoolean()
	sendInvoice?: boolean;
}

/** `PUT /invoice-schedules/:id`: what is sent replaces what is stored; `paused` pauses or resumes the schedule. */
export class UpdateInvoiceScheduleDTO extends InvoiceScheduleScopeDTO implements IInvoiceScheduleUpdateInput {
	@ApiPropertyOptional({ enum: InvoiceScheduleFrequencyEnum })
	@IsOptional()
	@IsEnum(InvoiceScheduleFrequencyEnum)
	frequency?: InvoiceScheduleFrequencyEnum;

	@ApiPropertyOptional({ type: () => String, example: '2026-10-01' })
	@IsOptional()
	@Matches(DAY_SHAPE)
	startDay?: string;

	@ApiPropertyOptional({ enum: InvoiceScheduleGroupingEnum })
	@IsOptional()
	@IsEnum(InvoiceScheduleGroupingEnum)
	grouping?: InvoiceScheduleGroupingEnum;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	sendInvoice?: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		description: 'true pauses the schedule; false resumes it, from today: the periods it skipped are not billed.'
	})
	@IsOptional()
	@IsBoolean()
	paused?: boolean;
}

/** `GET /invoice-schedules`: the schedules of an organization, or of one of its clients. */
export class InvoiceScheduleListQueryDTO extends InvoiceScheduleScopeDTO implements IInvoiceScheduleFindInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationContactId?: ID;
}

/** `GET /invoice-schedules/:id/runs`: a schedule's latest runs, newest first. */
export class InvoiceScheduleRunsQueryDTO extends InvoiceScheduleScopeDTO {
	@ApiPropertyOptional({
		type: () => Number,
		minimum: 1,
		maximum: MAX_INVOICE_SCHEDULE_RUNS_PER_PAGE,
		default: 12
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(MAX_INVOICE_SCHEDULE_RUNS_PER_PAGE)
	take?: number;
}
