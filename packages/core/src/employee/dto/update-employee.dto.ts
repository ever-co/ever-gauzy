import { IEmployeeUpdateInput } from "@gauzy/contracts";
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
) implements IEmployeeUpdateInput {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isJobSearchActive?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isVetted?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isTrackingEnabled: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    allowScreenshotCapture?: boolean;

    /** Employee status (Online/Offline) */
    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isOnline?: boolean;

    /** Employee time tracking status */
    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    isTrackingTime?: boolean;
}
