import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { IIntegrationSettingUpdateInput } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "../../core/dto";

/**
 *
 */
export class UpdateIntegrationSettingDTO extends IntersectionType(
    TenantOrganizationBaseDTO
) implements IIntegrationSettingUpdateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    settingsValue: string;
}
