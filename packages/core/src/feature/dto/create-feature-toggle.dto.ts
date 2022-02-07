import { IFeatureOrganizationUpdateInput, IOrganization } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString,IsNotEmpty, IsBoolean, IsOptional, ValidateNested } from "class-validator";
import { TenantDTO } from "tenant/dto";

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
    readonly organizationId: string;

    @ApiProperty({ type : () => Object })
    @IsOptional()
    readonly organization: IOrganization;

    @ApiProperty({ type : () => Object })
    @IsOptional()
    @ValidateNested()
    @Type(() => TenantDTO)
    readonly tenant: TenantDTO;

}