import { IOrganizationProject } from './organization-projects.model';

export interface ITaskProjectSequence {
	project: IOrganizationProject;
	projectId: string;
	taskNumber: number;
}
