import { IFeatureOrganizationUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsString,IsNotEmpty, IsBoolean, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export class CreateFeatureToggleDTO extends TenantOrganizationBaseDTO implements IFeatureOrganizationUpdateInput {
    
    @ApiProperty({ type : () => String })
    @IsNotEmpty()
    @IsString()
    readonly featureId: string;

    @ApiProperty({ type : () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isEnabled: boolean;

}