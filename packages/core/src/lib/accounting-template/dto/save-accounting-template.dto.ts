import { AccountingTemplateTypeEnum, IAccountingTemplateUpdateInput, LanguagesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Save accounting template request DTO validation
 */
export class SaveAccountingTemplateDTO extends TenantOrganizationBaseDTO
    implements IAccountingTemplateUpdateInput {

    @ApiProperty({ type: () => String, enum: LanguagesEnum, readOnly: true })
    @IsEnum(LanguagesEnum)
	readonly languageCode: LanguagesEnum;

    @ApiProperty({ type: () => String, enum: AccountingTemplateTypeEnum, readOnly: true })
    @IsEnum(AccountingTemplateTypeEnum)
	readonly templateType: AccountingTemplateTypeEnum;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
	readonly mjml: string;
}