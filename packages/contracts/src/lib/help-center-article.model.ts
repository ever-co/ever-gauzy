import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IOrganizationProject } from './organization-projects.model';
import { ITag } from './tag.model';

export interface IHelpCenterArticle
	extends IBasePerTenantAndOrganizationEntityModel {
	// Existing fields (For original articles)
	name: string;
	description?: string;
	data?: string;
	index: number;
	draft?: boolean;
	privacy?: boolean;
	categoryId: ID;
	employees?: IEmployee[];
	authors?: IHelpCenterAuthor[];

	// Rich content for collaborative articles
	descriptionHtml?: string;
	descriptionJson?: JsonData;

	// Parent-child hierarchy (self-referencing)
	parentId?: ID;
	parent?: IHelpCenterArticle;
	children?: IHelpCenterArticle[];

	// Owner (distinct from authors who can edit)
	ownedById?: ID;
	ownedBy?: IEmployee;

	// Project relation
	projectId?: ID;
	project?: IOrganizationProject;

	// Metadata
	isLocked?: boolean;
	color?: string;

	// External integration
	externalId?: string;

	// Tags
	tags?: ITag[];

	// Versions
	versions?: IHelpCenterArticleVersion[];
}

/**
 * Article version
 * This is used to track changes to articles over time
 */
export interface IHelpCenterArticleVersion
	extends IBasePerTenantAndOrganizationEntityModel {
	// Article relation
	articleId: ID;
	article?: IHelpCenterArticle;

	// Who created this version
	ownedById?: ID;
	ownedBy?: IEmployee;

	// When this version was saved
	lastSavedAt: Date;

	// Content snapshot
	descriptionHtml?: string;
	descriptionJson?: JsonData;
}

export interface IHelpCenterAuthor
	extends IBasePerTenantAndOrganizationEntityModel {
	articleId: string;
	article?: IHelpCenterArticle;
	employeeId: string;
	employee?: IEmployee;
	articles?: IHelpCenterArticle[];
}

export interface IHelpCenterAuthorCreate
	extends IBasePerTenantAndOrganizationEntityModel {
	articleId: string;
	employeeIds: string[];
}

export interface IHelpCenterAuthorFind
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface IHelpCenterArticleUpdate extends Partial<IHelpCenterArticle> { }
