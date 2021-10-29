import { Connection } from 'typeorm';
import * as faker from 'faker';
import {
	ContactOrganizationInviteStatus,
	ContactType,
	IEmployee,
	IOrganization,
	IOrganizationContact,
	ITag,
	ITenant,
	OrganizationContactBudgetTypeEnum
} from '@gauzy/contracts';
import * as _ from 'underscore';
import { getDummyImage } from '../core';
import { Organization, OrganizationContact, Tag } from './../core/entities/internal';
import { getRandomContact } from 'contact/contact.seed';

export const createDefaultOrganizationContact = async (
	connection: Connection,
	tenant: ITenant,
	noOfContactsPerOrganization: number
): Promise<IOrganizationContact[]> => {
	return await createOrganizationContact(
		connection,
		tenant,
		noOfContactsPerOrganization
	)
};

export const createRandomOrganizationContact = async (
	connection: Connection,
	tenants: ITenant[],
	noOfContactsPerOrganization: number
) => {
	for await (const tenant of tenants) {
		await createOrganizationContact(
			connection,
			tenant,
			noOfContactsPerOrganization
		)
	}
};

const createOrganizationContact = async (
	connection: Connection,
	tenant: ITenant,
	noOfContactsPerOrganization: number
) => {
	const organizations = await connection.manager.find(Organization, { 
		where: { 
			tenant
		}, 
		relations: ['employees'] 
	});
	const allCrganizationContacts: IOrganizationContact[] = [];
	for await (const organization of organizations) {
		const { employees } = organization;
		const organizationContacts: IOrganizationContact[] = [];
		const tags = await connection.manager.find(Tag, { 
			where: { tenant, organization }
		});
		for (let i = 0; i < noOfContactsPerOrganization; i++) {
			const orgContact = await generateOrganizationContact(
				tenant,
				organization,
				tags
			)
			organizationContacts.push(orgContact);
		}
		await connection.manager.save(organizationContacts);
		await assignOrganizationContactToEmployee(
			connection,
			tenant,
			organization,
			employees
		);
		allCrganizationContacts.push(...organizationContacts);
	}
	return allCrganizationContacts;
}

const generateOrganizationContact = async (
	tenant: ITenant,
	organization: IOrganization,
	tags: ITag[]
): Promise<IOrganizationContact> => {
	const contact = getRandomContact(tenant, organization);

	const orgContact = new OrganizationContact();
	orgContact.name = contact.name;
	orgContact.organization = organization;
	orgContact.tenant = tenant;
	orgContact.contact = contact;
	orgContact.contactType = faker.random.arrayElement(Object.values(ContactType));
	orgContact.budgetType = faker.random.arrayElement(
		Object.values(OrganizationContactBudgetTypeEnum)
	);
	orgContact.budget =
		orgContact.budgetType == OrganizationContactBudgetTypeEnum.COST
			? faker.datatype.number({ min: 200, max: 2000 })
			: faker.datatype.number({ min: 20, max: 40 });

	const email = faker.internet.exampleEmail(contact.firstName, contact.lastName);
	orgContact.emailAddresses = [email];
	orgContact.inviteStatus = faker.random.arrayElement(Object.values(ContactOrganizationInviteStatus));

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

/*
* Assign Organization Contact To Respective Employees
*/
export const assignOrganizationContactToEmployee = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[]
) => {
	const organizationContacts = await connection.manager.find(OrganizationContact, { 
		where: {
			tenant,
			organization
		} 
	});
	for await (const employee of employees) {
		employee.organizationContacts = _.chain(organizationContacts)
			.shuffle()
			.take(faker.datatype.number({ min: 2, max: 4 }))
			.unique()
			.values()
			.value();
	}
	await connection.manager.save(employees);
};