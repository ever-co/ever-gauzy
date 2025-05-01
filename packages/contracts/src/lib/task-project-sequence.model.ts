import { ID } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';

export interface ITaskProjectSequence {
	id?: ID;
	project: IOrganizationProject;
	projectId: string;
	taskNumber: number;
}
