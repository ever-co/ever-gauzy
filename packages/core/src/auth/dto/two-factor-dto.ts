import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { IUserCodeInput, IUserEmailInput, IUserTokenInput } from "@gauzy/contracts";
import { UserCodeDTO, UserEmailDTO, UserTokenDTO } from "../../user/dto";

/**
 *
 */
export class WorkspaceSigninEmailVerifyDTO extends IntersectionType(
    UserEmailDTO,
    UserCodeDTO,
) implements IUserEmailInput, IUserCodeInput {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly includeTeams: boolean;
}

/**
 *
 */
export class WorkspaceSigninDTO extends IntersectionType(
    UserEmailDTO,
    UserTokenDTO,
) implements IUserEmailInput, IUserTokenInput { }
