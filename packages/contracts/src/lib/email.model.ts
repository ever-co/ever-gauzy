import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalEmailTemplate } from './email-template.model';
import { IRelationalUser } from './user.model';

export enum EmailStatusEnum {
	SENT = 'SENT',
	FAILED = 'FAILED'
}

export interface IEmailHistoryBase extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	content: string;
	email: string;
	status?: EmailStatusEnum;
}

export interface IEmailHistory extends IEmailHistoryBase, IRelationalUser, IRelationalEmailTemplate {}

export interface IResendEmailInput extends IBasePerTenantAndOrganizationEntityModel {}

export interface IEmailFindInput extends Partial<IEmailHistory> {}

export type IEmailUpdateInput = Partial<IEmailHistoryBase> & IRelationalUser & Partial<IRelationalEmailTemplate>;
