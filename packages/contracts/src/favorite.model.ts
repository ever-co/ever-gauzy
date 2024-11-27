import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IFavorite extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput, IBasePerEntityType {}

export interface IFavoriteCreateInput extends IFavorite {}
