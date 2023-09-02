import { IUserCodeInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { CustomLength } from "./../../shared/validators";

/**
 * User code input DTO validation
 */
export class UserCodeDTO implements IUserCodeInput {

    @ApiProperty({ type: () => Number })
    @IsString()
    @CustomLength(6)
    readonly code: string;
}
