import { ApiProperty, IntersectionType, PickType } from "@nestjs/swagger";
import { IOrganizationTeamJoinRequestValidateInput } from "@gauzy/contracts";
import { IsString, ValidateIf } from "class-validator";
import { Transform, TransformFnParams } from "class-transformer";
import { CustomLength } from "../../shared/validators";
import { UserEmailDTO } from "../../user/dto";
import { OrganizationTeamJoinRequest } from "../organization-team-join-request.entity";

/**
 * Validate team join request DTO validation
 */
export class ValidateJoinRequestDTO extends IntersectionType(
    UserEmailDTO,
    PickType(OrganizationTeamJoinRequest, ['organizationTeamId'])
) implements IOrganizationTeamJoinRequestValidateInput {

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => !it.token)
    @IsString()
    @CustomLength(6)
    readonly code: string;

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => !it.code)
    @IsString()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly token: string;
}
