import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRequestApproval } from './request-approval.model';
import { IOrganizationTeam } from './organization-team.model';

export interface IRequestApprovalTeam extends IBasePerTenantAndOrganizationEntityModel {
	requestApprovalId: string;
	teamId: string;
	status: number;
	requestApproval: IRequestApproval;
	team: IOrganizationTeam;
}
