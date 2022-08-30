import { EmailTemplateNameEnum, IEmailTemplateSaveInput, LanguagesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "../../core/dto";

/**
 * Save email template request DTO validation
 */
export class SaveEmailTemplateDTO extends TenantOrganizationBaseDTO
    implements IEmailTemplateSaveInput {

    @ApiProperty({ type: () => String, enum: LanguagesEnum, readOnly: true })
    @IsEnum(LanguagesEnum)
	readonly languageCode: LanguagesEnum;

    @ApiProperty({ type: () => String, enum: EmailTemplateNameEnum, readOnly: true })
    @IsEnum(EmailTemplateNameEnum)
	readonly name: EmailTemplateNameEnum;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
	readonly mjml: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
	readonly subject: string;
}