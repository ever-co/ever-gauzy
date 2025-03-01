import { IURLMetaData } from './timesheet.model';
import { IBasePerEntityType, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

export interface IResourceLink extends IBasePerEntityType, IEmployeeEntityInput {
	title: string;
	url: string;
	metaData?: string | IURLMetaData;
}

export interface IResourceLinkCreateInput extends OmitFields<IResourceLink> {}

export interface IResourceLinkUpdateInput
	extends Partial<OmitFields<IResourceLinkCreateInput, 'employee' | 'employeeId' | 'entity' | 'entityId'>> {}
