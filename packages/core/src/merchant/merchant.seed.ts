import { Connection } from 'typeorm';
import { Tenant, Merchant, Contact, ImageAsset } from 'core';
import * as faker from 'faker';
import { IOrganization } from '@gauzy/contracts';


export const createRandomMerchants = async (
    connection: Connection,
    tenants: Tenant[],
    tenantOrganizationsMap: Map<Tenant, IOrganization[]>
) => {

    if (!tenantOrganizationsMap) {
        console.warn(
            'Warning: tenantOrganizationsMap not found, Product Merchants not be created'
        );
        return;
    }


    let merchants: Merchant[] = [];

    for (const tenant of tenants) {
        const tenantOrgs = tenantOrganizationsMap.get(tenant);
        for (const tenantOrg of tenantOrgs) {

            for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
                const merchant = applyRandomProperties(new Merchant());

                merchant.organization = tenantOrg;
                merchant.tenant = tenant;

                merchants.push(merchant);
            }
        }
    }

    await connection.manager.save(merchants);

}


export const createDefaultMerchants = async (connection: Connection,
    tenant: Tenant,
    organizations: IOrganization[]
) => {

    let merchants: Merchant[] = [];

    for (const organization of organizations) {
        const merchant = applyRandomProperties(new Merchant());

        merchant.organization = organization;
        merchant.tenant = tenant;

        merchants.push(merchant);
    } 

    await connection.manager.save(merchants);

}

const applyRandomProperties = (merchant: Merchant) => {
    merchant.name = faker.company.companyName();
    merchant.code = faker.random.alphaNumeric();
    merchant.email = faker.internet.email();
    merchant.description = faker.lorem.words();
    merchant.phone = faker.phone.phoneNumber();

    const contact = new Contact();
    contact.website = faker.internet.url();
    contact.address = faker.address.streetAddress();
    contact.country = faker.address.country();
    contact.city = faker.address.city();
    contact.fax = faker.datatype.number(8).toString();
    contact.longitude = +faker.address.longitude();
    contact.latitude = +faker.address.latitude();

    const logo = new ImageAsset();
    logo.name = faker.name.title();
    logo.url = faker.image.imageUrl();

    merchant.logo = logo;
    merchant.contact = contact;

    return merchant;
}