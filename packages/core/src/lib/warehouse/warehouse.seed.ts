import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { ICountry, IOrganization, ITenant, IWarehouse } from '@gauzy/contracts';
import {
    Country,
    Warehouse,
    Contact,
    Product,
    WarehouseProduct,
    WarehouseProductVariant,
    ImageAsset
} from '../core/entities/internal';
import { getEmailWithPostfix } from '../core/seeds/utils';


export const createRandomWarehouses = async (
    dataSource: DataSource,
    tenants: ITenant[],
    tenantOrganizationsMap: Map<ITenant, IOrganization[]>
) => {

    if (!tenantOrganizationsMap) {
        console.warn(
            'Warning: tenantOrganizationsMap not found, Product Warehouses will not be created'
        );
        return;
    }

    const countries: ICountry[] = await dataSource.manager.find(Country);
    for await (const tenant of tenants) {
        const organizations = tenantOrganizationsMap.get(tenant);
        let warehouses: IWarehouse[] = [];
        for await (const organization of organizations) {
            const products = await dataSource.manager.find(Product, {
                where: {
                    tenantId: tenant.id,
                    organizationId: organization.id
                },
                relations: {
                    variants: true
                }
            });
            for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
                const warehouse = applyRandomProperties(tenant, organization, countries);
                warehouse.products = [];

                for (let i = 0; i <= Math.floor(Math.random() * 2); i++) {
                    const product = faker.helpers.arrayElement(products);

                    let warehouseProduct = new WarehouseProduct();
                    warehouseProduct.product = product;
                    warehouseProduct.tenant = tenant;
                    warehouseProduct.organization = organization;
                    warehouseProduct.variants = [];

                    let productsQuantity = 0;
                    for await (const variant of product.variants) {
                        const quantity = faker.number.int(200);
                        productsQuantity += quantity;

                        const warehouseVariant = new WarehouseProductVariant();
                        warehouseVariant.tenant = tenant;
                        warehouseVariant.organization = organization;
                        warehouseVariant.variant = variant;
                        warehouseVariant.quantity = quantity;
                        warehouseProduct.variants.push(warehouseVariant);
                    }

                    warehouseProduct.quantity = productsQuantity;
                    warehouse.products.push(warehouseProduct);
                }
                warehouses.push(warehouse);
            }
        }
        await dataSource.manager.save(warehouses);
    }
}

const applyRandomProperties = (
    tenant: ITenant,
    organization: IOrganization,
    countries: ICountry[]
) => {
    const warehouse = new Warehouse()
    warehouse.name = faker.company.name();
    warehouse.code = faker.string.uuid();
    warehouse.email = getEmailWithPostfix(faker.internet.exampleEmail({ firstName: warehouse.name }));
    warehouse.description = faker.lorem.words();
    warehouse.active = faker.datatype.boolean();
    warehouse.organization = organization;
    warehouse.tenant = tenant;

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

    warehouse.contact = contact;
    warehouse.logo = logo;

    return warehouse;
}
