import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

/**
 * Get public employee request DTO validation
 */
export enum EmployeeRelationEnum {
    'user' = 'user',
    'organizationEmploymentTypes' = 'organizationEmploymentTypes',
	'skills' = 'skills'
}

export class PublicEmployeeQueryDTO {

    @ApiPropertyOptional({ type: () => String, enum: EmployeeRelationEnum })
    @IsOptional()
    @IsEnum(EmployeeRelationEnum, { each: true })
    readonly relations: string[];
}