import { IFeatureOrganizationUpdateInput, IOrganization, ITenant } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsString,IsNotEmpty, IsBoolean, IsOptional } from "class-validator";

export class CreateFeatureToggleDTO implements IFeatureOrganizationUpdateInput {
    
    @ApiProperty({ type : () => String })
    @IsNotEmpty()
    @IsString()
    readonly featureId: string;

    @ApiProperty({ type : () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isEnabled: boolean;

    @ApiProperty({ type : () => String })
    @IsOptional()
    @IsString()
    readonly organizationId?: string;

    @ApiProperty({ type : () => Object })
    @IsOptional()
    readonly organization?: IOrganization;

    @ApiProperty({ type : () => Object })
    @IsOptional()
    @IsString()
    readonly tenantId?: string;

    @ApiProperty({ type : () => Object })
    @IsOptional()
    @IsString()
    readonly tenant?: ITenant;

}