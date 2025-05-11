import { IBasePerEntityType, JsonData } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IEmployeeRecentVisit extends IBasePerEntityType, IEmployeeEntityInput {
	visitedAt: Date;
	data?: JsonData;
}
