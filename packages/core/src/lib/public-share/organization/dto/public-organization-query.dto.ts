import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

/**
 * Get public organization request DTO validation
 */
export enum OrganizationRelationEnum {
    'image' = 'image',
    'skills' = 'skills',
    'awards' = 'awards',
    'languages' = 'languages',
    'languages.language' = 'languages.language'
}

export class PublicOrganizationQueryDTO {

    @ApiPropertyOptional({ type: () => String, enum: OrganizationRelationEnum })
    @IsOptional()
    @IsEnum(OrganizationRelationEnum, { each: true })
    readonly relations: string[];
}
