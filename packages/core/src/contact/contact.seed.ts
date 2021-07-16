import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IContact, ICountry, IOrganization, ITenant } from '@gauzy/contracts';
import { Contact, Country } from './../core/entities/internal';

export const createRandomContacts = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[],
	noOfRandomContacts: number
): Promise<Contact[]> => {
	const countries: ICountry[] = await connection.manager.find(Country);
	const contacts: IContact[] = [];
	for (let i = 0; i < noOfRandomContacts; i++) {
		for (const organization of organizations) {
			const contact: IContact = new Contact();
			contact.firstName = faker.name.firstName();
			contact.lastName = faker.name.lastName();
			contact.website = faker.internet.url();
			contact.address = faker.address.streetAddress();
			contact.address2 = faker.address.secondaryAddress();
			contact.city = faker.address.city();
			contact.country = faker.random.arrayElement(countries).isoCode;
			contact.name = contact.firstName + ' ' + contact.lastName;
			contact.longitude = +faker.address.longitude();
			contact.latitude = +faker.address.latitude();
			contact.postcode = faker.address.zipCode();
			contact.organization = organization;
			contact.tenant = tenant;
			contacts.push(contact);
		}
	}
	return await connection.manager.save(contacts);
};
