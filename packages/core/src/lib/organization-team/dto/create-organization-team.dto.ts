import { IOrganizationTeamCreateInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
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

    /**
     * Give the new team a few common labels as its own tags (off unless `true`).
     */
    @ApiPropertyOptional({
        type: () => Boolean,
        description: 'Give the new team a few common labels (Bug, Feature, …) as its own tags. Off unless true.'
    })
    @IsOptional()
    @IsBoolean()
    readonly withStarterTags?: boolean;
}
