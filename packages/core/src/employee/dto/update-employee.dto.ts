import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { EmployeePublicSettingDTO } from "./employee-public-setting.dto";
import { UpdateProfileDTO } from "./update-profile.dto";

/**
 * Only SUPER_ADMIN/ADMIN updates these fields
 * Private fields DTO
 */
export class UpdateEmployeeDTO extends IntersectionType(
    UpdateProfileDTO,
    EmployeePublicSettingDTO
) {
    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isActive?: boolean;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isJobSearchActive?: boolean;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isVerified?: boolean;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isVetted?: boolean;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isTrackingEnabled: boolean;
}