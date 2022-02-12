import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { UpdateProfileDTO } from "./update-profile.dto";

/**
 * Only SUPER_ADMIN/ADMIN updates these fields
 * Private fields DTO
 */
export class UpdateEmployeeDTO extends UpdateProfileDTO {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isActive?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isJobSearchActive?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isVerified?: boolean;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isVetted?: boolean;
}