import { ICustomSmtp } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { CustomSmtpQueryDTO } from "./custom-smtp.query.dto";

/**
 * Custom Smtp Request DTO validation
 */
export class CustomSmtpDTO extends CustomSmtpQueryDTO implements ICustomSmtp {

	@ApiProperty({ type: () => String, examples: ['noreply@domain.com'] })
	@IsEmail()
	readonly fromAddress: string;

    @ApiProperty({ type: () => String, examples: ['smtp.postmarkapp.com', 'smtp.gmail.com'] })
	@IsString()
	readonly host: string;

	@ApiProperty({ type: () => Number, examples: [587, 465] })
	@IsNumber()
	readonly port: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly secure: boolean;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	readonly username: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	readonly password: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isValidate: boolean;
}