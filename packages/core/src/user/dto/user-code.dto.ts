import { IUserCodeInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { CustomLength } from "./../../shared/validators";

/**
 * User code input DTO validation
 */
export class UserCodeDTO implements IUserCodeInput {

    @ApiProperty({ type: () => Number })
    @IsNumber()
    @CustomLength(6)
    readonly code: number;
}