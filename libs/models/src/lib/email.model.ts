import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { EmailTemplateFindInput, ITenant } from '..';
import { EmailTemplate } from './email-template.model';
import { User } from './user.model';
import { Organization } from './organization.model';

export interface Email extends IBaseEntityModel {
	name: string;
	content: string;
	emailTemplate: EmailTemplate;
	email: string;
	organizationId?: string;
	user?: User;
	organization?: Organization;
	tenant: ITenant;
}

export interface EmailFindInput extends IBaseEntityModel {
	emailTemplate?: EmailTemplateFindInput;
	// TODO! Maybe user here
	userId?: string;
	email?: string;
	organizationId?: string;
}
