import { EmailTemplateGeneratePreviewHandler } from './email-template.generate-preview.handler';
import { EmailTemplateQueryHandler } from './email-template.handler';
import { FindEmailTemplateHandler } from './email-template.find.handler';

export const QueryHandlers = [
	EmailTemplateGeneratePreviewHandler,
	EmailTemplateQueryHandler,
	FindEmailTemplateHandler
];
