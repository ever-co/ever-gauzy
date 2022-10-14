import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class OrganizationTeamDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String, isArray: true, readOnly: true })
    @IsOptional()
    @IsArray()
    readonly members: string[] = [];

    @ApiProperty({ type: () => String, isArray: true , readOnly: true})
    @IsOptional()
    @IsArray()
    readonly managers: string[] = [];
}