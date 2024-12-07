import { IOrganizationEmploymentTypeCreateInput, ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class CreateOrganizationEmploymentTypeDTO extends TenantOrganizationBaseDTO 
    implements IOrganizationEmploymentTypeCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsArray()
    readonly tags?: ITag[];
}