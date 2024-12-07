import { IUserCodeInput, IUserEmailInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/swagger";
import { UserCodeDTO, UserEmailDTO } from "./../../user/dto";

/**
 * Validate invite by code DTO validation
 */
export class ValidateInviteByCodeQueryDTO extends IntersectionType(
    UserEmailDTO,
    UserCodeDTO,
) implements IUserEmailInput, IUserCodeInput { }
