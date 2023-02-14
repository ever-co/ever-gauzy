import { DataSource } from 'typeorm';
import { IOrganization, IRequestApprovalTeam, ITenant } from '@gauzy/contracts';
import { RequestApprovalTeam } from './request-approval-team.entity';
import { faker } from '@faker-js/faker';
import { ApprovalPolicy, OrganizationTeam, RequestApproval } from './../core/entities/internal';

export const createRandomRequestApprovalTeam = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IRequestApprovalTeam[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Request Approval Team  will not be created'
		);
		return;
	}
	const requestApprovalTeams: IRequestApprovalTeam[] = [];
	for await (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const { id: organizationId } = organization;
			const approvalPolicies = await dataSource.manager.find(ApprovalPolicy, {
				where: {
					organizationId,
					tenantId
				}
			});
			const organizationTeams = await dataSource.manager.find(OrganizationTeam, {
				where: {
					organizationId,
					tenantId
				}
			});
			for (const approvalPolicy of approvalPolicies) {
				const { id: approvalPolicyId } = approvalPolicy;
				const requestApprovals = await dataSource.manager.find(RequestApproval, {
					where: {
						approvalPolicyId,
						organizationId,
						tenantId
					}
				});
				for await (const requestApproval of requestApprovals) {
					for await (const organizationTeam of organizationTeams) {
						const requestApprovalTeam = new RequestApprovalTeam();
						requestApprovalTeam.requestApproval = requestApproval;
						requestApprovalTeam.team = organizationTeam;
						requestApprovalTeam.tenant = tenant;
						requestApprovalTeam.organization = organization;
						requestApprovalTeam.status = faker.number.int(3);
						requestApprovalTeams.push(requestApprovalTeam);
					}
				}
			}
		}
	}
	return await dataSource.manager.save(requestApprovalTeams);
};
