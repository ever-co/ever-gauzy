import { IntersectionType } from "@nestjs/swagger";
import { IUserLoginInput } from "@gauzy/contracts";
import { UserEmailDTO } from "./user-email.dto";
import { UserPasswordDTO } from "./user-password.dto";

/**
 * User login DTO validation
 */
export class UserLoginDTO extends IntersectionType(
    UserEmailDTO,
    UserPasswordDTO
) implements IUserLoginInput {}