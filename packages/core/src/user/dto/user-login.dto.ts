import { IntersectionType, PartialType } from "@nestjs/swagger";
import { IUserEmailInput, IUserPasswordInput } from "@gauzy/contracts";
import { UserEmailDTO } from "./user-email.dto";
import { UserPasswordDTO } from "./user-password.dto";
import { UserTokenDTO } from "./user-token.dto";

export class UserSigninWorkspaceDTO extends IntersectionType(
    UserEmailDTO,
    UserPasswordDTO
) implements IUserEmailInput, IUserPasswordInput { }

/**
 * User login DTO validation
 */
export class UserLoginDTO extends IntersectionType(
    UserSigninWorkspaceDTO,
    PartialType(UserTokenDTO)
) implements IUserEmailInput, IUserPasswordInput { }
