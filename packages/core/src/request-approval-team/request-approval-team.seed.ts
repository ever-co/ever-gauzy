import { Connection } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { RequestApprovalTeam } from './request-approval-team.entity';
import * as faker from 'faker';
import { ApprovalPolicy, OrganizationTeam, RequestApproval } from './../core/entities/internal';

export const createRandomRequestApprovalTeam = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<RequestApprovalTeam[]> => {
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

	const requestApprovalEmployees: RequestApprovalTeam[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);

		for (const tenantOrg of tenantOrgs) {
			const approvalPolicies = await connection.manager.find(
				ApprovalPolicy,
				{
					where: [{ organization: tenantOrg }]
				}
			);

			const organizationTeams = await connection.manager.find(
				OrganizationTeam,
				{
					where: [{ organizationId: tenantOrg.id }]
				}
			);

			for (const approvalPolicy of approvalPolicies) {
				const requestApprovals = await connection.manager.find(
					RequestApproval,
					{
						where: [{ approvalPolicy: approvalPolicy }]
					}
				);

				for (const requestApproval of requestApprovals) {
					for (const organizationTeam of organizationTeams) {
						const requestApprovalEmployee = new RequestApprovalTeam();

						requestApprovalEmployee.requestApprovalId =
							requestApproval.id;
						requestApprovalEmployee.requestApproval = requestApproval;
						requestApprovalEmployee.teamId = organizationTeam.id;
						requestApprovalEmployee.team = organizationTeam;
						requestApprovalEmployee.tenant = tenant;
						requestApprovalEmployee.organization = tenantOrg;
						requestApprovalEmployee.status = faker.datatype.number(3);

						requestApprovalEmployees.push(requestApprovalEmployee);
					}
				}
			}
		}
	}

	await connection.manager.save(requestApprovalEmployees);
};
