import {
    IOrganizationDepartment,
    IOrganizationEmploymentType,
    IOrganizationPosition,
    ISkill,
    ITag
} from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from 'class-transformer';
import { CreateOrganizationEmployementTypeDTO } from "./../../organization-employment-type/dto";
import { HiringDTO } from "./hiring.dto";
import { CreateOrganizationDepartmentDTO } from "./../../organization-department/dto";

export abstract class EmploymentDTO extends HiringDTO {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString({
        message: "Started worked on must be a Date string"
    })
    readonly startedWorkOn?: String;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly short_description?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description?: string;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly anonymousBonus?: boolean;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOrganizationEmployementTypeDTO)
    readonly organizationEmploymentTypes?: IOrganizationEmploymentType[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOrganizationDepartmentDTO)
    readonly organizationDepartments?: IOrganizationDepartment[];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly employeeLevel?: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly organizationPosition?: IOrganizationPosition;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly tags?: ITag[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly skills?: ISkill[];
}