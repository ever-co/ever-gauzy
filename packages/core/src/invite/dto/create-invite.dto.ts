import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ICreateEmailInvitesInput, InvitationTypeEnum } from "@gauzy/contracts";

/**
 * Create Invite DTO validation
 */
export class CreateInviteDTO implements ICreateEmailInvitesInput {

    @ApiProperty({ type: () => Array })
    @IsNotEmpty()
    readonly emailIds: string[];

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly roleId: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly invitedById: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    @IsEnum(InvitationTypeEnum)
    readonly inviteType: string;

    @ApiProperty({ type: () => Date })
    readonly startedWorkOn: Date;
}