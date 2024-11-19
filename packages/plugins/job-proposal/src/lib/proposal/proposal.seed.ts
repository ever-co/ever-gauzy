import { DataSource } from 'typeorm';
import { Proposal } from './proposal.entity';
import { faker } from '@faker-js/faker';
import moment from 'moment';
import { OrganizationContact, Tag } from '@gauzy/core';
import { IEmployee, IOrganization, ITenant, ProposalStatusEnum } from '@gauzy/contracts';

/**
 * Creates default proposals for organizations.
 *
 * @param connection The database connection.
 * @param tenant The tenant information.
 * @param employees The list of employees.
 * @param organizations The list of organizations.
 * @param noOfProposalsPerOrganization The number of proposals to create per organization.
 * @returns A promise that resolves to an array of created proposals.
 */
export const createDefaultProposals = async (
	connection: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	organizations: IOrganization[],
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {

	const proposals: Proposal[] = [];
	const tagsMap = new Map<string, Tag[]>();
	const organizationContactsMap = new Map<string, OrganizationContact[]>();

	// Fetch tags and organization contacts for each organization asynchronously
	await Promise.all(
		organizations.map(async (organization) => {
			const tags = await connection.manager.findBy(Tag, { organizationId: organization.id });
			const organizationContacts = await connection.manager.findBy(OrganizationContact, {
				organizationId: organization.id,
				tenantId: tenant.id
			});
			tagsMap.set(organization.id, tags);
			organizationContactsMap.set(organization.id, organizationContacts);
		})
	);

	// Generate proposals for each organization
	organizations.forEach((organization) => {
		const tags = tagsMap.get(organization.id) || [];
		const organizationContacts = organizationContactsMap.get(organization.id) || [];
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
	});

	// Save generated proposals
	return await connection.manager.save(proposals, { chunk: 30 });
};

/**
 * Creates random proposals for organizations across multiple tenants.
 *
 * @param connection The database connection.
 * @param tenants An array of tenants.
 * @param tenantOrganizationsMap A map containing organizations for each tenant.
 * @param organizationEmployeesMap A map containing employees for each organization.
 * @param noOfProposalsPerOrganization The number of proposals to create per organization.
 * @returns A Promise that resolves with the created proposals.
 */
export const createRandomProposals = async (
	connection: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfProposalsPerOrganization: number
): Promise<Proposal[]> => {
	const proposals: Proposal[] = [];

	// Pre-fetch tags and organization contacts for all organizations
	const organizationTagsMap: Map<string, Tag[]> = new Map();
	const organizationContactsMap: Map<string, OrganizationContact[]> = new Map();

	for (const [tenant, organizations] of tenantOrganizationsMap.entries()) {
		for (const organization of organizations) {
			const { id: tenantId } = tenant;
			const { id: organizationId } = organization;

			const tags = await connection.manager.findBy(Tag, { organizationId, tenantId });
			organizationTagsMap.set(organizationId, tags);

			const contacts = await connection.manager.findBy(OrganizationContact, { organizationId, tenantId });
			organizationContactsMap.set(organizationId, contacts);
		}
	}

	// Generate proposals for each organization
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		if (!organizations) continue;

		for (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization);
			if (!employees) continue;

			const { id: organizationId } = organization;

			const tags = organizationTagsMap.get(organizationId) || [];
			const organizationContacts = organizationContactsMap.get(organizationId) || [];

			for (let i = 0; i < noOfProposalsPerOrganization; i++) {
				const proposal = new Proposal();
				proposal.employee = faker.helpers.arrayElement(employees);
				proposal.jobPostUrl = faker.internet.url();
				proposal.jobPostContent = faker.person.jobTitle();
				proposal.status = faker.helpers.arrayElement(Object.values(ProposalStatusEnum));
				proposal.tags = [faker.helpers.arrayElement(tags)];
				proposal.valueDate = moment(faker.date.recent({ days: 0.5 })).startOf('day').toDate();
				proposal.proposalContent = faker.person.jobDescriptor();
				proposal.organization = organization;
				proposal.tenant = tenant;
				if (organizationContacts.length) {
					proposal.organizationContact = faker.helpers.arrayElement(organizationContacts);
				}
				proposals.push(proposal);
			}
		}
	}

	// Save the generated proposals in batches
	return await connection.manager.save(proposals, { chunk: 30 });
};
