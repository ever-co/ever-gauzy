import { IUserEmailInput, IUserTokenInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/swagger";
import { UserEmailDTO, UserTokenDTO } from "../../user/dto";

/**
 * Invite validate DTO request validation
 */
export class ValidateInviteQueryDTO extends IntersectionType(
    UserEmailDTO,
    UserTokenDTO,
) implements IUserEmailInput, IUserTokenInput {}