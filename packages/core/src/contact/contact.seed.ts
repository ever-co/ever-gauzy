import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IContact, IOrganization, ITenant } from '@gauzy/contracts';
import { Contact } from './../core/entities/internal';

export const createRandomContacts = async (
	dataSource: DataSource,
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
			await dataSource.manager.save(organization);

			contacts.push(contact);
		}
	}
	return await dataSource.manager.save(contacts);
};

export const getRandomContact = (
	tenant: ITenant,
	organization: IOrganization
) => {
	const contact: IContact = new Contact();
	contact.firstName = faker.person.firstName();
	contact.lastName = faker.person.lastName();
	contact.website = faker.internet.url();
	contact.address = faker.location.streetAddress();
	contact.address2 = faker.location.secondaryAddress();
	contact.city = faker.location.city();
	contact.country = faker.location.countryCode();
	contact.name = contact.firstName + ' ' + contact.lastName;
	contact.longitude = +faker.location.longitude();
	contact.latitude = +faker.location.latitude();
	contact.postcode = faker.location.zipCode();
	contact.organization = organization;
	contact.tenant = tenant;
	return contact;
}
