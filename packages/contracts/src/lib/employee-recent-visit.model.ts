import { IBasePerEntityType, JsonData, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IEmployeeRecentVisit extends IBasePerEntityType, IEmployeeEntityInput {
	visitedAt: Date;
	data?: JsonData;
}

export interface IEmployeeRecentVisitInput extends OmitFields<IEmployeeRecentVisit, 'visitedAt'> {}
