import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { UserEmailDTO } from "./../../user/dto";

export class FindInviteQueryDTO extends UserEmailDTO {

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly token: string;
}