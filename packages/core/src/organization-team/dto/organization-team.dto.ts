import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IOrganizationTeam } from "@gauzy/contracts";
import { IsTeamAlreadyExist } from "./../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class OrganizationTeamDTO extends TenantOrganizationBaseDTO implements IOrganizationTeam {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @IsTeamAlreadyExist()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly prefix?: string;

    @ApiPropertyOptional({ type: () => String, isArray: true })
    @IsOptional()
    @IsArray()
    readonly memberIds?: string[] = [];

    @ApiPropertyOptional({ type: () => String, isArray: true })
    @IsOptional()
    @IsArray()
    readonly managerIds?: string[] = [];
}