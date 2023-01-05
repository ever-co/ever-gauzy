import { IntersectionType } from "@nestjs/swagger";
import { IUserCodeInput, IUserEmailInput } from "@gauzy/contracts";
import { UserCodeDTO, UserEmailDTO } from "../../user/dto";

/**
 * Send auth code DTO validation
 */
export class SendAuthCodeDTO extends UserEmailDTO implements IUserEmailInput {}


/**
 * Verify auth code DTO validation
 */
export class VerifyAuthCodeDTO extends IntersectionType(
    UserEmailDTO,
    UserCodeDTO,
) implements IUserEmailInput, IUserCodeInput {}