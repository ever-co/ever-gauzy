import { IOrganizationProjectSetting } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { TenantOrganizationBaseDTO } from "../../core/dto";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateProjectSettingDTO extends TenantOrganizationBaseDTO implements IOrganizationProjectSetting {

    // External repository ID property
    @ApiPropertyOptional({ type: Number })
    @IsOptional()
    @IsNumber()
    readonly externalRepositoryId: number;

    // Auto-sync tasks property
    @ApiPropertyOptional({ type: Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isTasksAutoSync: boolean;

    // Auto-sync on label property
    @ApiPropertyOptional({ type: Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isTasksAutoSyncOnLabel: boolean;

    // Auto-sync tasks label property
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    readonly syncTag: string;
}
