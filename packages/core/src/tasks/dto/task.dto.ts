import {
    IEmployee,
    IOrganizationProject,
    IOrganizationTeam,
    TaskStatusEnum
} from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString
} from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class TaskDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type : () => String})
    @IsNotEmpty()
    @IsString()
    readonly title: string;

    @ApiProperty({ type: () => String, enum: TaskStatusEnum })
    @IsEnum(TaskStatusEnum)
    readonly status: TaskStatusEnum;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description: string;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly dueDate: Date;

    @ApiPropertyOptional({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly estimate: number;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly members: IEmployee[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly teams: IOrganizationTeam[];

    @ApiProperty({ type : () => Object })
    @IsOptional()
    @IsObject()
    readonly project: IOrganizationProject;
}