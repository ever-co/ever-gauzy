import { IOrganizationEmploymentTypeCreateInput, ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateOrganizationEmploymentTypeDTO implements IOrganizationEmploymentTypeCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly organizationId: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsArray()
    readonly tags?: ITag[];
}