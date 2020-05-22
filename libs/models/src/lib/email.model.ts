import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { EmailTemplateFindInput } from '..';
import { EmailTemplate } from './email-template.model';
import { User } from './user.model';

export interface Email extends IBaseEntityModel {
	name?: string;
	content?: string;
	emailTemplate?: EmailTemplate;
	languageCode?: string;
	orgId?: string;
	user?: User;
	email?: string;
}

export interface EmailFindInput extends IBaseEntityModel {
	emailTemplate?: EmailTemplateFindInput;
	// TODO! Maybe user here
	userId?: string;
	valueDate?: Date;
	organizationId?: string;
}
