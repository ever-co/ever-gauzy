import { IContact, IEmployeeUpdateInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";
import { IntersectionType } from '@nestjs/mapped-types';
import { SocialNetworksDTO } from "./network.dto";
import { EmploymentDTO } from "./employment.dto";
import { HiringDTO } from "./hiring.dto";
import { RatesDTO } from "./rates.dto";

/**
 * Only EMPLOYEE updates these fields
 * Public Fields DTO
 */
export class UpdateProfileDTO extends IntersectionType(
    SocialNetworksDTO,
    EmploymentDTO,
    HiringDTO,
    RatesDTO
) implements IEmployeeUpdateInput {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly profile_link?: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsObject()
    @IsOptional()
    readonly contact?: IContact;
}