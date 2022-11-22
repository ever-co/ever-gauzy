import { IUserTokenInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * User token input DTO validation
 */
export class UserTokenDTO implements IUserTokenInput {

    @ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	readonly token: string;
}