import { DataSource } from 'typeorm';
import { Proposal } from './proposal.entity';
import { faker } from '@ever-co/faker';
import * as moment from 'moment';
import { Tag } from '../tags/tag.entity';
import { IEmployee, IOrganization, ITenant, ProposalStatusEnum } from '@gauzy/contracts';
import { OrganizationContact } from './../core/entities/internal';

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
		const tags = await dataSource.manager.find(Tag, {
			where: {
				organizationId
			}
		});
		const organizationContacts = await dataSource.manager.find(OrganizationContact, {
			where: {
				organizationId,
				tenantId
			}
		});
		for (let i = 0; i < noOfProposalsPerOrganization; i++) {
			const proposal = new Proposal();
			proposal.employee = faker.random.arrayElement(employees);
			proposal.jobPostUrl = faker.internet.url();
			proposal.jobPostContent = faker.name.jobTitle();
			proposal.organization = organization;
			proposal.status = faker.random.arrayElement(Object.values(ProposalStatusEnum));
			proposal.tags = [faker.random.arrayElement(tags)];
			proposal.valueDate = moment(faker.date.recent(0.5)) .startOf('day').toDate();
			proposal.proposalContent = faker.name.jobDescriptor();
			proposal.tenant = tenant;
			if (organizationContacts.length) {
				proposal.organizationContactId = faker.random.arrayElement(organizationContacts).id;
			}
			proposals.push(proposal);
		}
	}

	return await dataSource.manager.save(proposals);
};

export const createRandomProposals = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {
	const proposals: Proposal[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);
		const employees = tenantEmployeeMap.get(tenant);
		for (const organization of organizations) {
			const { id: organizationId } = organization;
			const tags = await dataSource.manager.find(Tag, {
				where: {
					organizationId
				}
			});
			const organizationContacts = await dataSource.manager.find(OrganizationContact, {
				where: {
					organizationId,
					tenantId
				}
			});
			for (let i = 0; i < noOfProposalsPerOrganization; i++) {
				const proposal = new Proposal();
				proposal.employee = faker.random.arrayElement(employees);
				proposal.jobPostUrl = faker.internet.url();
				proposal.jobPostContent = faker.name.jobTitle();
				proposal.organization = organization;
				proposal.status = faker.random.arrayElement(Object.values(ProposalStatusEnum));
				proposal.tags = [faker.random.arrayElement(tags)];
				proposal.valueDate = moment(faker.date.recent(0.5)) .startOf('day').toDate();
				proposal.proposalContent = faker.name.jobDescriptor();
				proposal.tenant = tenant;
				if (organizationContacts.length) {
					proposal.organizationContactId = faker.random.arrayElement(organizationContacts).id;
				}
				proposals.push(proposal);
			}
		}
	}

	return await dataSource.manager.save(proposals);
};
