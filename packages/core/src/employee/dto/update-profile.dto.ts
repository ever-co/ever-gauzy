import { IContact, IEmployeeUpdateInput } from "@gauzy/contracts";
import { ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";
import { IntersectionType } from '@nestjs/mapped-types';
import { SocialNetworksDTO } from "./network.dto";
import { EmploymentDTO } from "./employment.dto";
import { HiringDTO } from "./hiring.dto";
import { RatesDTO } from "./rates.dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { Employee } from "./../employee.entity";

/**
 * EMPLOYEE can updates these fields only
 * Public Fields DTO
 */
export class UpdateProfileDTO extends IntersectionType(
    SocialNetworksDTO,
    EmploymentDTO,
    HiringDTO,
    RatesDTO,
    RelationalTagDTO,
    PickType(Employee, ['upworkId', 'linkedInId']),
) implements IEmployeeUpdateInput {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly profile_link?: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsObject()
    @IsOptional()
    readonly contact?: IContact;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isAway?: boolean;
}
