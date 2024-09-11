import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IFavorite extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	entity: FavoriteEntityEnum;
	entityId: ID; // Indicate the ID of entity record marked as favorite
}

export enum FavoriteEntityEnum {
	Organization = 'Organization',
	OrganizationProject = 'OrganizationProject',
	OrganizationTeam = 'OrganizationTeam',
	OrganizationProjectModule = 'OrganizationProjectModule',
	Currency = 'Currency',
	Language = 'Language',
	OrganizationVendor = 'OrganizationVendor',
	OrganizationSprint = 'OrganizationSprint'
}

export interface IFavoriteCreateInput extends IFavorite {}
