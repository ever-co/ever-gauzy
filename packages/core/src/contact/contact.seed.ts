import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IContact, IOrganization, ITenant } from '@gauzy/contracts';
import { Contact } from './../core/entities/internal';

export const createRandomContacts = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[],
	noOfRandomContacts: number
): Promise<IContact[]> => {
	const contacts: IContact[] = [];
	for (let i = 0; i < noOfRandomContacts; i++) {
		for await (const organization of organizations) {
			const contact: IContact = getRandomContact(
				tenant,
				organization
			);

			// organization primary contact location
			organization.contact = contact;
			await connection.manager.save(organization);

			contacts.push(contact);
		}
	}
	return await connection.manager.save(contacts);
};

export const getRandomContact = (
	tenant: ITenant,
	organization: IOrganization
) => {
	const contact: IContact = new Contact();
	contact.firstName = faker.name.firstName();
	contact.lastName = faker.name.lastName();
	contact.website = faker.internet.url();
	contact.address = faker.address.streetAddress();
	contact.address2 = faker.address.secondaryAddress();
	contact.city = faker.address.city();
	contact.country = faker.address.countryCode();
	contact.name = contact.firstName + ' ' + contact.lastName;
	contact.longitude = +faker.address.longitude();
	contact.latitude = +faker.address.latitude();
	contact.postcode = faker.address.zipCode();
	contact.organization = organization;
	contact.tenant = tenant;
	return contact;
}
