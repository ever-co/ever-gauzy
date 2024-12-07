import { IEstimateEmailFindInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { RelationsQueryDTO } from "./../../shared/dto";

export class FindEstimateEmailQueryDTO extends RelationsQueryDTO implements IEstimateEmailFindInput {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsEmail()
	readonly email: string;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly token: string;
}