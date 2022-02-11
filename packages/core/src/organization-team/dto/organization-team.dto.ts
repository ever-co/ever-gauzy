import { ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export abstract class OrganizationTeamDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsString()
    @IsNotEmpty()
    readonly name: string;

    @ApiProperty({ type: () => String, isArray: true, readOnly: true })
    @IsArray()
    @ArrayNotEmpty()
    readonly members: string[];

    @ApiProperty({ type: () => String, isArray: true , readOnly: true})
    @IsOptional()
    readonly managers: string[];

    @ApiProperty({ type: () => Object, isArray: true, readOnly: true })
    @IsOptional()
    readonly tags: ITag[];

}