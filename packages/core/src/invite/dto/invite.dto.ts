import { InvitationTypeEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEnum, ArrayNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Invite DTO validation
 */
 export class InviteDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => Array, readOnly: true })
    @ArrayNotEmpty()
    readonly emailIds: string[] = [];

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly invitedById: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    @IsEnum(InvitationTypeEnum)
    readonly inviteType: InvitationTypeEnum;

    @ApiProperty({ type: () => Date, readOnly: true })
    readonly startedWorkOn: Date;
}