import { Connection } from 'typeorm';
import { Proposal } from './proposal.entity';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';

export const createDefaultProposals = async (
	connection: Connection,
	tenant: ITenant,
	employees: IEmployee[],
	organizations: IOrganization[],
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
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
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
