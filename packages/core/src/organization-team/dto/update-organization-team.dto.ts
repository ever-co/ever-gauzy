import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IOrganizationTeamUpdateInput } from "@gauzy/contracts";
import { OrganizationTeamDTO } from "./organization-team.dto";
import { IsTeamAlreadyExist } from "./../../shared/validators";

/**
 * Update organization team request DTO's
 */
export class UpdateOrganizationTeamDTO extends OrganizationTeamDTO implements IOrganizationTeamUpdateInput {

    @ApiProperty({ type: () => String, required: true })
    @IsNotEmpty()
    @IsString()
    readonly id: string;

    @ApiPropertyOptional({ type: () => String, required: false })
    @IsOptional()
    @IsString()
    @IsTeamAlreadyExist()
    readonly name: string;
}
