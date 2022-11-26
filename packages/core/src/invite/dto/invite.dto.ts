import { InvitationExpirationEnum, InvitationTypeEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, ArrayNotEmpty, IsOptional, ValidateIf } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Invite DTO validation
 */
 export class InviteDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => Array })
    @ArrayNotEmpty()
    readonly emailIds: string[] = [];

    @ApiProperty({ type: () => String, enum: InvitationTypeEnum })
    @IsEnum(InvitationTypeEnum)
    readonly inviteType: InvitationTypeEnum;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    readonly startedWorkOn: Date;

    @ApiPropertyOptional({ type: () => String, enum: InvitationExpirationEnum })
    @IsOptional()
    readonly invitationExpirationPeriod: InvitationExpirationEnum;
}