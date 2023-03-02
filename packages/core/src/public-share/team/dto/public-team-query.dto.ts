import { ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Transform, TransformFnParams } from "class-transformer";
import { IBaseRelationsEntityModel, IDateRangePicker } from "@gauzy/contracts";
import { DateRangeQueryDTO } from "./../../../shared/dto";

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
    'tasks.teams' = 'tasks.teams'
}

export class PublicTeamQueryDTO extends PickType(
    DateRangeQueryDTO, ['startDate', 'endDate']
) implements IDateRangePicker, IBaseRelationsEntityModel {

    @ApiPropertyOptional({ type: () => String, enum: PublicTeamRelationEnum })
    @IsOptional()
    @IsEnum(PublicTeamRelationEnum, { each: true })
    @Transform(({ value }: TransformFnParams) => (value) ? value.map((element: string) => element.trim()) : {})
    readonly relations: string[];
}
