import { Connection } from 'typeorm';
import { IEmployee, IOrganization, IRequestApprovalTeam, ITenant } from '@gauzy/contracts';
import { RequestApprovalTeam } from './request-approval-team.entity';
import * as faker from 'faker';
import { ApprovalPolicy, OrganizationTeam, RequestApproval } from './../core/entities/internal';

export const createRandomRequestApprovalTeam = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IRequestApprovalTeam[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Request Approval Team  will not be created'
		);
		return;
	}
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Request Approval Team  will not be created'
		);
		return;
	}

	const requestApprovalTeams: IRequestApprovalTeam[] = [];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const approvalPolicies = await connection.manager.find(ApprovalPolicy, {
				where: {
					organization
				}
			});
			const organizationTeams = await connection.manager.find(OrganizationTeam, {
				where: {
					organization
				}
			});
			for (const approvalPolicy of approvalPolicies) {
				const requestApprovals = await connection.manager.find(RequestApproval, {
					where: { 
						approvalPolicy,
						organization
					}
				});
				for await (const requestApproval of requestApprovals) {
					for await (const organizationTeam of organizationTeams) {
						const requestApprovalTeam = new RequestApprovalTeam();
						requestApprovalTeam.requestApproval = requestApproval;
						requestApprovalTeam.team = organizationTeam;
						requestApprovalTeam.tenant = tenant;
						requestApprovalTeam.organization = organization;
						requestApprovalTeam.status = faker.datatype.number(3);
						requestApprovalTeams.push(requestApprovalTeam);
					}
				}
			}
		}
	}
	return await connection.manager.save(requestApprovalTeams);
};
