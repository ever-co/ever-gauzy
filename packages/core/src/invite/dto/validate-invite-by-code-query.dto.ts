import { IUserInviteCodeConfirmationInput } from "@gauzy/contracts";
import { ConfirmTwoFactorCodeDTO } from "../../auth/dto";

/**
 * Confirm invite by code DTO validation
 */
export class ValidateInviteByCodeQueryDTO extends ConfirmTwoFactorCodeDTO implements IUserInviteCodeConfirmationInput {}