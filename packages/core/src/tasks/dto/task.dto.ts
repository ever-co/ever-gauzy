import {
    IEmployee,
    IOrganizationProject,
    IOrganizationTeam,
    TaskPriorityEnum,
    TaskSizeEnum,
    TaskStatusEnum
} from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsArray,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString
} from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class TaskDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly title: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly status: TaskStatusEnum;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly priority: TaskPriorityEnum;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly size: TaskSizeEnum;

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

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly project: IOrganizationProject;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly projectId: IOrganizationProject['id'];
}
