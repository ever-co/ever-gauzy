import { IInvite, IInviteResendInput } from "@gauzy/contracts";
import { ApiProperty, IntersectionType, PickType } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { InviteDTO } from "./invite.dto";

/**
 * Resend invite DTO validation
 */
export class ResendInviteDTO extends IntersectionType(TenantOrganizationBaseDTO, PickType(
    InviteDTO, ['callbackUrl', 'inviteType']
)) implements IInviteResendInput {

    @ApiProperty({ type: () => String })
    @IsUUID()
    readonly inviteId: IInvite['id'];
}