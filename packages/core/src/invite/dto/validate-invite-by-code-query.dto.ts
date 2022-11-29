import { IUserInviteCodeConfirmationInput } from "@gauzy/contracts";
import { ConfirmInviteCodeDTO } from "../../auth/dto";

/**
 * Confirm invite by code DTO validation
 */
export class ValidateInviteByCodeQueryDTO extends ConfirmInviteCodeDTO implements IUserInviteCodeConfirmationInput {}