import { ICustomSmtpCreateInput } from "@gauzy/contracts";
import { ApiProperty, IntersectionType, PickType } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { CustomSmtp } from "./../custom-smtp.entity";
import { CustomSmtpQueryDTO } from "./custom-smtp.query.dto";

/**
 * Create custom SMTP Request DTO validation
 */
export class CreateCustomSmtpDTO extends IntersectionType(
    PickType(CustomSmtp, ['fromAddress', 'host', 'port', 'secure', 'isValidate']),
    CustomSmtpQueryDTO
) implements ICustomSmtpCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly username: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly password: string;
}
