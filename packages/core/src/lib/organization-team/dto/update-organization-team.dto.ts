import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { IOrganizationTeamUpdateInput } from "@gauzy/contracts";
import { WithoutInitializers } from "@gauzy/common";
import { OrganizationTeamDTO } from "./organization-team.dto";
import { IsTeamAlreadyExist } from "./../../shared/validators";

/**
 * Update organization team request DTO's.
 *
 * Built through `WithoutInitializers`: `OrganizationTeamDTO` defaults `projects`, `memberIds` and `managerIds` to
 * empty lists, and a `PUT` that did not name them used to write `projects: []` back - clearing the team's projects
 * (review R3-04, measured by `tools/scripts/update-dto-initializer-check.mjs`).
 */
export class UpdateOrganizationTeamDTO extends WithoutInitializers(OrganizationTeamDTO) implements IOrganizationTeamUpdateInput {

    @ApiProperty({ type: () => String, required: true })
    @IsNotEmpty()
    @IsUUID()
    readonly id: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    @IsTeamAlreadyExist()
    readonly name: string;
}
