import { IOrganizationTeam } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsNotEmpty, IsBoolean } from "class-validator";

/**
 * Accept/Reject Invite DTO validation
 */
export class AcceptMyInviteDTO {
    @ApiProperty({ type: () => String, required: true })
    @IsNotEmpty()
    @IsUUID()
    organizationTeamId: IOrganizationTeam['id'];

    @ApiProperty({ type: () => Boolean, required: true })
    @IsNotEmpty()
    @IsBoolean()
    accept: boolean;
}
