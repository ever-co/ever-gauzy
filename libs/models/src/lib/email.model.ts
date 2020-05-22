import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { EmailTemplateFindInput } from '..';
import { EmailTemplate } from './email-template.model';

export interface Email extends IBaseEntityModel {
	name?: string;
	content?: string;
	emailTemplate?: EmailTemplate;
	languageCode?: string;
	orgId?: string;
	userId?: string;
	email?: string;
}

export interface EmailFindInput extends IBaseEntityModel {
	emailTemplate?: EmailTemplateFindInput;
	userId?: string;
	valueDate?: Date;
	orgId?: string;
}
