import { IEmailTemplateFindInput } from "@gauzy/contracts";
import { OmitType } from "@nestjs/mapped-types";
import { SaveEmailTemplateDTO } from "./save-email-template.dto";

/**
 * GET email template query request DTO validation
 */
export class EmailTemplateQueryDTO extends OmitType(
    SaveEmailTemplateDTO, ['mjml', 'subject'] as const
) implements IEmailTemplateFindInput {}