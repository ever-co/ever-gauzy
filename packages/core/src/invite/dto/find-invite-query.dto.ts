import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class FindInviteQueryDTO {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsEmail()
	readonly email: string;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly token: string;
}