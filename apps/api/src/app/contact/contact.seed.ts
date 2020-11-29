import { Connection } from 'typeorm';
import { Contact } from './contact.entity';
import * as faker from 'faker';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Country } from '../country';
import { ICountry } from '@gauzy/models';

export const createRandomContacts = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[],
	noOfRandomContacts: number
): Promise<Contact[]> => {
	const countries: ICountry[] = await connection.manager.find(Country);
	const contacts: Contact[] = [];

	for (let i = 0; i < noOfRandomContacts; i++) {
		organizations.forEach((organization: Organization) => {
			const contact = new Contact();
			contact.firstName = faker.name.firstName();
			contact.lastName = faker.name.lastName();
			contact.address = faker.address.streetAddress();
			contact.address2 = faker.address.secondaryAddress();
			contact.city = faker.address.city();
			contact.country = faker.random.arrayElement(countries).isoCode;
			contact.name = contact.firstName + ' ' + contact.lastName;
			contact.organization = organization;
			contact.tenant = tenant;
			contacts.push(contact);
		});
	}
	return await connection.manager.save(contacts);
};
