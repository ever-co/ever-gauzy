import { ApiProperty } from "@nestjs/swagger";
import { IOrganizationTeam, IOrganizationTeamEmployeeFindInput } from "@gauzy/contracts";
import { IsNotEmpty, IsUUID } from 'class-validator';
import { DeleteQueryDTO } from "./../../shared/dto";
import { OrganizationTeamEmployee } from "./../../core/entities/internal";

/**
 * Delete team member query DTO
 */
export class DeleteTeamMemberQueryDTO extends DeleteQueryDTO<OrganizationTeamEmployee> implements IOrganizationTeamEmployeeFindInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsUUID()
    readonly organizationTeamId: IOrganizationTeam['id'];
}
