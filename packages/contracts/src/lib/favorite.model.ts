import { BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IFavorite extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	entity: BaseEntityEnum;
	entityId: ID; // Indicate the ID of entity record marked as favorite
}

export interface IFavoriteCreateInput extends IFavorite {}
