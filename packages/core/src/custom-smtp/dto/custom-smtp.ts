import { ICustomSmtp } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

/**
 * Custom Smtp Request DTO validation
 */
export class CustomSmtpDTO implements ICustomSmtp {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	readonly host: string;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNumber()
	readonly port: number;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsBoolean()
	readonly secure: boolean;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	readonly username: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	readonly password: string;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsBoolean()
	@IsOptional()
	readonly isValidate: boolean;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly organizationId: string;
}