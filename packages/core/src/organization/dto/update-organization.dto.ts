import { CurrenciesEnum, IOrganizationUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { CreateOrganizationDTO } from "./create-organization.dto";

export class UpdateOrganizationDTO extends CreateOrganizationDTO 
    implements IOrganizationUpdateInput {

    @ApiProperty({ type: () => String, required: true })
	@IsOptional()
	@IsString()
	readonly name: string;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum })
    @IsOptional()
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;
}