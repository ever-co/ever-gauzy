import { Connection } from 'typeorm';
import { Merchant, Contact, ImageAsset, Country } from './../core/entities/internal';
import * as faker from 'faker';
import { ICountry, IMerchant, IOrganization, ITenant } from '@gauzy/contracts';

export const createRandomMerchants = async (
    connection: Connection,
    tenants: ITenant[],
    tenantOrganizationsMap: Map<ITenant, IOrganization[]>
) => {
    if (!tenantOrganizationsMap) {
        console.warn(
            'Warning: tenantOrganizationsMap not found, Product Merchants not be created'
        );
        return;
    }

    const countries: ICountry[] = await connection.manager.find(Country);
    const merchants: IMerchant[] = [];

    for await (const tenant of tenants) {
        const organizations = tenantOrganizationsMap.get(tenant);
        for await (const organization of organizations) {
            for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
                const merchant = applyRandomProperties(tenant, organization, countries);
                merchant.organization = organization;
                merchant.tenant = tenant;
                merchants.push(merchant);
            }
        }
    }
    await connection.manager.save(merchants);
}


export const createDefaultMerchants = async (connection: Connection,
    tenant: ITenant,
    organizations: IOrganization[]
) => {
    const countries: ICountry[] = await connection.manager.find(Country);
    let merchants: IMerchant[] = [];
    for (const organization of organizations) {
        const merchant = applyRandomProperties(tenant, organization, countries);
        merchant.organization = organization;
        merchant.tenant = tenant;
        merchants.push(merchant);
    } 
    await connection.manager.save(merchants);
}

const applyRandomProperties = (
    tenant: ITenant,
    organization: IOrganization,
    countries: ICountry[]
) => {
    const merchant = new Merchant()
    merchant.name = faker.company.companyName();
    merchant.code = faker.random.alphaNumeric();
    merchant.email = faker.internet.email();
    merchant.description = faker.lorem.words();
    merchant.phone = faker.phone.phoneNumber();
    merchant.organization = organization;
    merchant.tenant = tenant;

    const contact = new Contact();
    contact.firstName = faker.name.firstName();
	contact.lastName = faker.name.lastName();
    contact.name = contact.firstName + ' ' + contact.lastName;
    contact.website = faker.internet.url();
    contact.address = faker.address.streetAddress();
    contact.address2 = faker.address.secondaryAddress();
    contact.city = faker.address.city();
    contact.country = faker.random.arrayElement(countries).isoCode;
    contact.fax = faker.datatype.number(8).toString();
    contact.longitude = +faker.address.longitude();
    contact.latitude = +faker.address.latitude();
    contact.organization = organization;
    contact.tenant = tenant;

    const logo = new ImageAsset();
    logo.name = faker.name.title();
    logo.url = faker.image.imageUrl();
    logo.organization = organization;
    logo.tenant = tenant;

    merchant.logo = logo;
    merchant.contact = contact;

    return merchant;
}