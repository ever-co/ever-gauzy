import { DataSource } from 'typeorm';
import { Proposal } from './proposal.entity';
import { faker } from '@faker-js/faker';
import * as moment from 'moment';
import { OrganizationContact, Tag } from '@gauzy/core';
import { IEmployee, IOrganization, ITenant, ProposalStatusEnum } from '@gauzy/contracts';

export const createDefaultProposals = async (
	dataSource: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	organizations: IOrganization[],
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {
	const { id: tenantId } = tenant;
	const proposals: Proposal[] = [];
	for (const organization of organizations) {
		const { id: organizationId } = organization;
		const tags = await dataSource.manager.findBy(Tag, {
			organizationId
		});
		const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
			organizationId,
			tenantId
		});
		for (let i = 0; i < noOfProposalsPerOrganization; i++) {
			const proposal = new Proposal();
			proposal.employee = faker.helpers.arrayElement(employees);
			proposal.jobPostUrl = faker.internet.url();
			proposal.jobPostContent = faker.person.jobTitle();
			proposal.organization = organization;
			proposal.status = faker.helpers.arrayElement(Object.values(ProposalStatusEnum));
			proposal.tags = [faker.helpers.arrayElement(tags)];
			proposal.valueDate = moment(faker.date.recent({ days: 0.5 })).startOf('day').toDate();
			proposal.proposalContent = faker.person.jobDescriptor();
			proposal.tenant = tenant;
			if (organizationContacts.length) {
				proposal.organizationContactId = faker.helpers.arrayElement(organizationContacts).id;
			}
			proposals.push(proposal);
		}
	}

	return await dataSource.manager.save(proposals);
};

export const createRandomProposals = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {
	const proposals: Proposal[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization);
			const { id: organizationId } = organization;
			const tags = await dataSource.manager.findBy(Tag, {
				organizationId
			});
			const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
				organizationId,
				tenantId
			});
			for (let i = 0; i < noOfProposalsPerOrganization; i++) {
				const proposal = new Proposal();
				proposal.employee = faker.helpers.arrayElement(employees);
				proposal.jobPostUrl = faker.internet.url();
				proposal.jobPostContent = faker.person.jobTitle();
				proposal.organization = organization;
				proposal.status = faker.helpers.arrayElement(Object.values(ProposalStatusEnum));
				proposal.tags = [faker.helpers.arrayElement(tags)];
				proposal.valueDate = moment(faker.date.recent({ days: 0.5 })).startOf('day').toDate();
				proposal.proposalContent = faker.person.jobDescriptor();
				proposal.tenant = tenant;
				if (organizationContacts.length) {
					proposal.organizationContactId = faker.helpers.arrayElement(organizationContacts).id;
				}
				proposals.push(proposal);
			}
		}
	}

	return await dataSource.manager.save(proposals);
};
