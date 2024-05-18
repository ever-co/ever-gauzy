import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IDateRangePicker, IOrganizationTeamStatisticInput } from '@gauzy/contracts';
import { DateRangeQueryDTO } from './../../../shared/dto';
import { OrganizationTeamStatisticDTO } from './../../../organization-team/dto';
import { TimerStatusQueryDTO } from './../../../time-tracking/timer/dto';

/**
 * Get public employee request DTO validation
 */
export enum PublicTeamRelationEnum {
	'organization' = 'organization',
	'members' = 'members',
	'members.employee' = 'members.employee',
	'members.employee.user' = 'members.employee.user',
	'tasks' = 'tasks',
	'tasks.members' = 'tasks.members',
	'tasks.teams' = 'tasks.teams',
	'tasks.tags' = 'tasks.tags',
	'statuses' = 'statuses',
	'priorities' = 'priorities',
	'sizes' = 'sizes',
	'labels' = 'labels',
	'issueTypes' = 'issueTypes'
}

export class PublicTeamQueryDTO extends IntersectionType(
	PickType(OrganizationTeamStatisticDTO, ['withLastWorkedTask']),
	PickType(DateRangeQueryDTO, ['startDate', 'endDate']),
	PickType(PartialType(TimerStatusQueryDTO), ['source'])
) implements IDateRangePicker, IOrganizationTeamStatisticInput {

	@ApiPropertyOptional({ type: () => String, enum: PublicTeamRelationEnum })
	@IsOptional()
	@IsEnum(PublicTeamRelationEnum, { each: true })
	@Transform(({ value }: TransformFnParams) => (value ? value.map((element: string) => element.trim()) : {}))
	readonly relations: string[];
}
