import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { ICountry, IMerchant, IOrganization, ITenant } from '@gauzy/contracts';
import { Merchant, Contact, ImageAsset, Country } from './../core/entities/internal';
import { getEmailWithPostfix } from '../core/seeds/utils';

export const createRandomMerchants = async (
    dataSource: DataSource,
    tenants: ITenant[],
    tenantOrganizationsMap: Map<ITenant, IOrganization[]>
) => {
    if (!tenantOrganizationsMap) {
        console.warn(
            'Warning: tenantOrganizationsMap not found, Product Merchants not be created'
        );
        return;
    }

    const countries: ICountry[] = await dataSource.manager.find(Country);
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
    await dataSource.manager.save(merchants);
}


export const createDefaultMerchants = async (dataSource: DataSource,
    tenant: ITenant,
    organizations: IOrganization[]
) => {
    const countries: ICountry[] = await dataSource.manager.find(Country);
    let merchants: IMerchant[] = [];
    for (const organization of organizations) {
        const merchant = applyRandomProperties(tenant, organization, countries);
        merchant.organization = organization;
        merchant.tenant = tenant;
        merchants.push(merchant);
    }
    await dataSource.manager.save(merchants);
}

const applyRandomProperties = (
    tenant: ITenant,
    organization: IOrganization,
    countries: ICountry[]
) => {
    const merchant = new Merchant()
    merchant.name = faker.company.name();
    merchant.code = faker.string.alphanumeric();
    merchant.email = getEmailWithPostfix(faker.internet.exampleEmail({ firstName: merchant.name }));
    merchant.description = faker.lorem.words();
    merchant.phone = faker.phone.number();
    merchant.organization = organization;
    merchant.tenant = tenant;

    const contact = new Contact();
    contact.firstName = faker.person.firstName();
    contact.lastName = faker.person.lastName();
    contact.name = contact.firstName + ' ' + contact.lastName;
    contact.website = faker.internet.url();
    contact.address = faker.location.streetAddress();
    contact.address2 = faker.location.secondaryAddress();
    contact.city = faker.location.city();
    contact.country = faker.helpers.arrayElement(countries).isoCode;
    contact.fax = faker.number.int(8).toString();
    contact.longitude = +faker.location.longitude();
    contact.latitude = +faker.location.latitude();
    contact.organization = organization;
    contact.tenant = tenant;

    const logo = new ImageAsset();
    logo.name = faker.company.name();
    logo.url = faker.image.url();
    logo.organization = organization;
    logo.tenant = tenant;

    merchant.logo = logo;
    merchant.contact = contact;

    return merchant;
}
