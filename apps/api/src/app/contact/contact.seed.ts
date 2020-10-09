import { Connection } from 'typeorm';
import { Contact } from './contact.entity';
import * as faker from 'faker';
import { Organization } from '../organization/organization.entity';

export const createRandomContacts = async (
	connection: Connection,
	noOfRandomContacts: number,
	organizations: Organization[]
): Promise<Contact[]> => {
	const contacts: Contact[] = [];
	for (let i = 0; i < noOfRandomContacts; i++) {
		organizations.forEach((organization: Organization) => {
			const contact = new Contact();
			contact.firstName = faker.name.firstName();
			contact.lastName = faker.name.lastName();
			contact.address = faker.address.streetAddress();
			contact.address2 = faker.address.secondaryAddress();
			contact.city = faker.address.city();
			contact.country = faker.address.country();
			contact.name = contact.firstName + ' ' + contact.lastName;
			// contact.organization = organization;
			// contact.tenant = organization.tenant;
			contacts.push(contact);
		});
	}
	return await connection.manager.save(contacts);
};
