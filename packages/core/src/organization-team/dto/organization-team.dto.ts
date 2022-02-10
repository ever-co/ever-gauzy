import { ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export abstract class OrganizationTeamDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String, isArray: true })
    @IsString()
    @IsNotEmpty()
    readonly name: string;

    @ApiProperty({ type: () => String, isArray: true })
    @IsArray()
    @ArrayNotEmpty()
    readonly members: string[];

    @ApiProperty({ type: () => String, isArray: true })
    @IsOptional()
    readonly managers: string[];

    @ApiProperty({ type: () => Object, isArray: true })
    @IsOptional()
    readonly tags: ITag[];

}