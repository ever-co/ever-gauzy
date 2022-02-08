import { IFeatureOrganizationUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsString,IsNotEmpty, IsBoolean } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class CreateFeatureToggleDTO extends TenantOrganizationBaseDTO implements IFeatureOrganizationUpdateInput {
    
    @ApiProperty({ type : () => String })
    @IsNotEmpty()
    @IsString()
    readonly featureId: string;

    @ApiProperty({ type : () => Boolean })
    @IsNotEmpty()
    @IsBoolean()
    readonly isEnabled: boolean;
}