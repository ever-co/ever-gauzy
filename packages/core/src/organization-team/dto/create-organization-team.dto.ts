import { IOrganizationTeamCreateInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsTeamAlreadyExist } from "./../../shared/validators";
import { OrganizationTeamDTO } from "./organization-team.dto";

/**
 * Create organization team request DTO's
 */
export class CreateOrganizationTeamDTO extends OrganizationTeamDTO implements IOrganizationTeamCreateInput {

    @ApiProperty({ type: () => String, required: true })
    @IsNotEmpty()
    @IsString()
    @IsTeamAlreadyExist()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly profile_link?: string;
}
