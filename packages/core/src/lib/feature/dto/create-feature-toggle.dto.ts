import { IFeatureOrganizationUpdateInput, IOrganization } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsString,IsNotEmpty, IsBoolean, IsOptional, IsObject } from "class-validator";
import { IsOrganizationBelongsToUser } from "./../../shared/validators";
import { TenantBaseDTO } from "./../../core/dto";

export class CreateFeatureToggleDTO extends TenantBaseDTO implements IFeatureOrganizationUpdateInput {

    @ApiProperty({ type : () => String })
    @IsNotEmpty()
    @IsString()
    readonly featureId: string;

    @ApiProperty({ type : () => Boolean })
    @IsNotEmpty()
    @IsBoolean()
    readonly isEnabled: boolean;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
	@IsObject()
	@IsOrganizationBelongsToUser()
	readonly organization: IOrganization;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	@IsOrganizationBelongsToUser()
	readonly organizationId: IOrganization['id'];
}