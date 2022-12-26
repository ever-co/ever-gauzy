import { IUserTokenInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * User token input DTO validation
 */
export class UserTokenDTO implements IUserTokenInput {

    @ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	readonly token: string;
}