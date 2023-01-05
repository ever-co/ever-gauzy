import { IntersectionType } from "@nestjs/swagger";
import { IUserCodeInput, IUserEmailInput } from "@gauzy/contracts";
import { UserCodeDTO, UserEmailDTO } from "../../user/dto";

/**
 * Send code DTO validation
 */
export class SendTwoFactorCodeDTO extends UserEmailDTO implements IUserEmailInput {}


/**
 * Confirm code DTO validation
 */
export class ConfirmTwoFactorCodeDTO extends IntersectionType(
    UserEmailDTO,
    UserCodeDTO,
) implements IUserEmailInput, IUserCodeInput {}