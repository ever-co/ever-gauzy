import { Connection } from 'typeorm';
import { Proposal } from './proposal.entity';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';

export const createDefaultProposals = async (
	connection: Connection,
	tenant: Tenant,
	employees: Employee[],
	organizations: Organization[],
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {
	const proposals: Proposal[] = [];
	for (const organization of organizations) {
		const tags = await connection.manager.find(Tag, {
			where: [{ organization: organization }]
		});
		for (let i = 0; i < noOfProposalsPerOrganization; i++) {
			const proposal = new Proposal();
			proposal.employee = faker.random.arrayElement(employees);
			proposal.jobPostUrl = faker.internet.url();
			proposal.jobPostContent = faker.name.jobTitle();
			proposal.organization = organization;
			proposal.status = faker.random.arrayElement(['ACCEPTED', 'SENT']);
			proposal.tags = [faker.random.arrayElement(tags)];
			proposal.valueDate = faker.date.recent();
			proposal.proposalContent = faker.name.jobDescriptor();
			proposal.tenant = tenant;
			proposals.push(proposal);
		}
	}

	return await connection.manager.save(proposals);
};

export const createRandomProposals = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {
	const proposals: Proposal[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		const employees = tenantEmployeeMap.get(tenant);
		for (const organization of organizations) {
			const tags = await connection.manager.find(Tag, {
				where: [{ organization: organization }]
			});
			for (let i = 0; i < noOfProposalsPerOrganization; i++) {
				const proposal = new Proposal();
				proposal.employee = faker.random.arrayElement(employees);
				proposal.jobPostUrl = faker.internet.url();
				proposal.jobPostContent = faker.name.jobTitle();
				proposal.organization = organization;
				proposal.status = faker.random.arrayElement([
					'ACCEPTED',
					'SENT'
				]);
				proposal.tags = [faker.random.arrayElement(tags)];
				proposal.valueDate = faker.date.recent();
				proposal.proposalContent = faker.name.jobDescriptor();
				proposal.tenant = tenant;
				proposals.push(proposal);
			}
		}
	}

	return await connection.manager.save(proposals);
};
