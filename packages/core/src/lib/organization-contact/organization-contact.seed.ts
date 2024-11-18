import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
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
import { getDummyImage } from '../core/utils';
import { Organization, OrganizationContact, Tag } from './../core/entities/internal';
import { getEmailWithPostfix } from '../core/seeds/utils';
import { getRandomContact } from '../contact/contact.seed';

export const createDefaultOrganizationContact = async (
	dataSource: DataSource,
	tenant: ITenant,
	noOfContactsPerOrganization: number
): Promise<IOrganizationContact[]> => {
	return await createOrganizationContact(
		dataSource,
		tenant,
		noOfContactsPerOrganization
	)
};

export const createRandomOrganizationContact = async (
	dataSource: DataSource,
	tenants: ITenant[],
	noOfContactsPerOrganization: number
) => {
	for await (const tenant of tenants) {
		await createOrganizationContact(
			dataSource,
			tenant,
			noOfContactsPerOrganization
		)
	}
};

const createOrganizationContact = async (
	dataSource: DataSource,
	tenant: ITenant,
	noOfContactsPerOrganization: number
) => {
	const { id: tenantId } = tenant;
	const organizations = await dataSource.manager.find(Organization, {
		where: {
			tenantId
		},
		relations: ['employees']
	});
	const allOrganizationContacts: IOrganizationContact[] = [];
	for await (const organization of organizations) {
		const { id: organizationId } = organization;
		const { employees } = organization;
		const organizationContacts: IOrganizationContact[] = [];
		const tags = await dataSource.manager.findBy(Tag, {
			organizationId,
			tenantId
		});
		for (let i = 0; i < noOfContactsPerOrganization; i++) {
			const orgContact = await generateOrganizationContact(
				tenant,
				organization,
				tags
			)
			organizationContacts.push(orgContact);
		}
		await dataSource.manager.save(organizationContacts);
		await assignOrganizationContactToEmployee(
			dataSource,
			tenant,
			organization,
			employees
		);
		allOrganizationContacts.push(...organizationContacts);
	}
	return allOrganizationContacts;
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
	orgContact.contactType = faker.helpers.arrayElement(Object.values(ContactType));
	orgContact.budgetType = faker.helpers.arrayElement(
		Object.values(OrganizationContactBudgetTypeEnum)
	);
	orgContact.budget =
		orgContact.budgetType == OrganizationContactBudgetTypeEnum.COST
			? faker.number.int({ min: 500, max: 5000 })
			: faker.number.int({ min: 40, max: 400 });

	const email = getEmailWithPostfix(faker.internet.exampleEmail(contact.firstName, contact.lastName));
	orgContact.inviteStatus = faker.helpers.arrayElement(Object.values(ContactOrganizationInviteStatus));

	const phone = faker.phone.number();
	orgContact.primaryEmail = email;
	orgContact.primaryPhone = phone;
	orgContact.imageUrl = getDummyImage(330, 300, (orgContact.name || faker.person.firstName()).charAt(0).toUpperCase());
	orgContact.tags = _.chain(tags)
		.shuffle()
		.take(faker.number.int({ min: 1, max: 2 }))
		.values()
		.value();
	return orgContact;
};

/*
* Assign Organization Contact To Respective Employees
*/
export const assignOrganizationContactToEmployee = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[]
) => {
	const { id: tenantId } = tenant;
	const { id: organizationId } = organization;

	const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
		organizationId,
		tenantId
	});
	for await (const employee of employees) {
		employee.organizationContacts = _.chain(organizationContacts)
			.shuffle()
			.take(faker.number.int({ min: 2, max: 4 }))
			.unique()
			.values()
			.value();
	}
	await dataSource.manager.save(employees);
};
