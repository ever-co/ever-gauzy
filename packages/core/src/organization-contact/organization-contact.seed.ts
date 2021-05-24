import { Connection } from 'typeorm';
import * as faker from 'faker';
import { ContactOrganizationInviteStatus, ContactType, IContact, IEmployee, IOrganization, ITag, ITenant } from '@gauzy/contracts';
import * as _ from 'underscore';
import { getDummyImage } from '../core';
import { Contact, Employee, Organization, OrganizationContact, Tag } from './../core/entities/internal';

export const createDefaultOrganizationContact = async (
	connection: Connection,
	tenant: ITenant
) => {
	const organizationContacts: OrganizationContact[] = [];
	const contacts = await connection.manager.find(Contact);
	const organizations = await connection.getRepository(Organization).find({ 
		where: { 
			tenant: tenant 
		}, 
		relations: ['employees', 'tags'] 
	});
	for (const organization of organizations) {
		for (let i = 0; i < faker.datatype.number({ min: 5, max: 6 }); i++) {
			const contact = faker.random.arrayElement(contacts);
			const { employees, tags } = organization;
			const orgContact = await generateOrganizationContact(
				tenant,
				organization,
				contact,
				employees,
				tags
			)
			organizationContacts.push(orgContact);
		}
	}
	return await connection.manager.save(organizationContacts);
};

export const createRandomOrganizationContact = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	noOfContactsPerOrganization: number
): Promise<OrganizationContact[]> => {
	const organizationContacts: OrganizationContact[] = [];
	const contacts = await connection.manager.find(Contact);
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const tags = await connection.manager.find(Tag, {
				where: [{ organization: organization }]
			});			
			const employees = await connection.manager.find(Employee, {
				where: [{ organization: organization }]
			});			
			for (let i = 0; i < noOfContactsPerOrganization; i++) {
				const contact = faker.random.arrayElement(contacts);
				const orgContact = await generateOrganizationContact(
					tenant,
					organization,
					contact,
					employees,
					tags
				)
				organizationContacts.push(orgContact);
			}
		}
	}
	await connection.manager.save(organizationContacts);
	return organizationContacts;
};

const generateOrganizationContact = async (
	tenant: ITenant,
	organization: IOrganization,
	contact: IContact,
	employees: IEmployee[],
	tags: ITag[]
): Promise<OrganizationContact> => {
	const orgContact = new OrganizationContact();
	orgContact.name = contact.name;
	orgContact.organization = organization;
	orgContact.tenant = tenant;
	orgContact.contact = contact;
	orgContact.contactType = faker.random.arrayElement(Object.values(ContactType));

	const email = faker.internet.email(contact.firstName, contact.lastName);
	orgContact.emailAddresses = [email];
	orgContact.inviteStatus = faker.random.arrayElement(Object.values(ContactOrganizationInviteStatus));
	orgContact.members = _.chain(employees)
		.shuffle()
		.take(faker.datatype.number({ min: 1, max: 3 }))
		.values()
		.value();
	const phone = faker.phone.phoneNumber();
	orgContact.phones = [phone];
	orgContact.primaryEmail = email;
	orgContact.primaryPhone = phone;
	orgContact.imageUrl = getDummyImage(330, 300, (orgContact.name || faker.name.firstName()).charAt(0).toUpperCase());
	orgContact.tags = _.chain(tags)
		.shuffle()
		.take(faker.datatype.number({ min: 1, max: 2 }))
		.values()
		.value();
	return orgContact;
};
