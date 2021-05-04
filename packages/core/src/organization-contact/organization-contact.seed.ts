import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationContact } from './organization-contact.entity';
import { Contact } from '../contact/contact.entity';
import * as faker from 'faker';
import { ContactOrganizationInviteStatus, ContactType } from '@gauzy/contracts';
import { Tag } from '../tags/tag.entity';
import * as _ from 'underscore';
import { getDummyImage } from '../core';

export const createDefaultOrganizationContact = async (
	connection: Connection
) => {
	const tenants = await connection.getRepository(Tenant).find();
	const organizationContacts: OrganizationContact[] = [];
	const contactTypes = Object.values(ContactType);
	const contactInvitationTypes = Object.values(
		ContactOrganizationInviteStatus
	);
	const contacts = await connection.manager.find(Contact);

	for (const tenant of tenants) {
		const organizations = await connection
			.getRepository(Organization)
			.find({
				where: { tenant: tenant },
				relations: ['employees', 'tags']
			});
		for (const org of organizations) {
			const employees = org.employees;

			const tags = org.tags;

			for (let i = 0; i < faker.datatype.number({ min: 5, max: 6 }); i++) {
				const orgContact = new OrganizationContact();

				const contact = faker.random.arrayElement(contacts);

				orgContact.contact = contact;

				orgContact.organizationId = org.id;
				orgContact.organization = org;

				orgContact.contactType = faker.random.arrayElement(
					contactTypes
				);

				orgContact.emailAddresses = [
					faker.internet.email(contact.firstName, contact.lastName)
				];

				orgContact.inviteStatus = faker.random.arrayElement(
					contactInvitationTypes
				);

				orgContact.members = _.chain(employees)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 3 }))
					.values()
					.value();

				orgContact.name = contact.name;
				orgContact.phones = [faker.phone.phoneNumber()];
				orgContact.primaryEmail = orgContact.emailAddresses[0];
				orgContact.primaryPhone = orgContact.phones[0];
				orgContact.tenant = tenant;

				orgContact.imageUrl = getDummyImage(
					330,
					300,
					orgContact.name.charAt(0).toUpperCase()
				);

				orgContact.tags = _.chain(tags)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 2 }))
					.values()
					.value();

				organizationContacts.push(orgContact);
			}
		}
	}

	return await connection.manager.save(organizationContacts);
};

export const createRandomOrganizationContact = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	noOfContactsPerOrganization: number
): Promise<OrganizationContact[]> => {
	const organizationContacts: OrganizationContact[] = [];

	const contactTypes = Object.values(ContactType);

	const contactInvitationTypes = Object.values(
		ContactOrganizationInviteStatus
	);

	const contacts = await connection.manager.find(Contact);

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);

		const employees = tenantEmployeeMap.get(tenant);

		for (const org of organizations) {
			const tags = await connection.manager.find(Tag, {
				where: [{ organization: org }]
			});

			for (let i = 0; i < noOfContactsPerOrganization; i++) {
				const orgContact = new OrganizationContact();

				orgContact.contact = faker.random.arrayElement(contacts);
				orgContact.organization = org;
				orgContact.contactType = faker.random.arrayElement(
					contactTypes
				);
				orgContact.emailAddresses = [
					faker.internet.email(
						orgContact.contact.firstName,
						orgContact.contact.lastName
					)
				];
				orgContact.inviteStatus = faker.random.arrayElement(
					contactInvitationTypes
				);

				orgContact.members = _.chain(employees)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 3 }))
					.values()
					.value();

				orgContact.name = orgContact.contact.name;
				orgContact.phones = [faker.phone.phoneNumber()];
				orgContact.primaryEmail = orgContact.emailAddresses[0];
				orgContact.primaryPhone = orgContact.phones[0];
				orgContact.tenant = tenant;

				orgContact.imageUrl = getDummyImage(
					330,
					300,
					orgContact.name.charAt(0).toUpperCase()
				);

				orgContact.tags = _.chain(tags)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 2 }))
					.values()
					.value();

				organizationContacts.push(orgContact);
			}
		}
	}

	await connection.manager.save(organizationContacts);

	return organizationContacts;
};
