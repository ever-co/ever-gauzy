import { IBasePerEntityType } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IFavorite extends IEmployeeEntityInput, IBasePerEntityType { }

export interface IFavoriteCreateInput extends IFavorite { }
