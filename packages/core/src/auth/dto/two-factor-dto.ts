import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { IUserInviteCodeConfirmationInput } from "@gauzy/contracts";
import { UserEmailDTO } from "../../user/dto";
import { CustomLength } from "./../../shared/validators";

/**
 * Send invite code DTO validation
 */
export class SendInviteCodeDTO extends UserEmailDTO {}

/**
 * Confirm invite code DTO validation
 */
export class ConfirmInviteCodeDTO extends UserEmailDTO implements IUserInviteCodeConfirmationInput {

    @ApiProperty({ type: () => Number })
    @IsNumber()
    @CustomLength(6)
    readonly code: number;
}