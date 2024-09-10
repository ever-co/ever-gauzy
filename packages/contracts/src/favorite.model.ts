import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IFavorite extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	favoritableType: FavoriteTypeEnum;
	relatedEntityId: ID; // Indicate the ID of entity record marked as favorite
}

export enum FavoriteTypeEnum {
	CURRENCY = 'currency',
	LANGUAGE = 'language',
	ORGANIZATION = 'organization',
	PROJECT = 'project',
	PROJECT_MODULE = 'project-module',
	TEAM = 'team',
	SPRINT = 'sprint',
	VENDOR = 'vendor'
}

export interface IFavoriteCreateInput extends IFavorite {}
