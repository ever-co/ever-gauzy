import { IAccountingTemplateFindInput } from "@gauzy/contracts";
import { OmitType } from "@nestjs/mapped-types";
import { SaveAccountingTemplateDTO } from "./save-accounting-template.dto";

/**
 * GET accounting template query request DTO validation
 */
export class AccountingTemplateQueryDTO extends OmitType(
    SaveAccountingTemplateDTO, ['mjml'] as const
) implements IAccountingTemplateFindInput {}