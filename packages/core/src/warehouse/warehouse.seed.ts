import { DataSource } from 'typeorm';
import { faker } from '@ever-co/faker';
import { ICountry, IOrganization, ITenant } from '@gauzy/contracts';
import {
    Country,
    Warehouse,
    Contact,
    Product,
    WarehouseProduct,
    WarehouseProductVariant,
    ImageAsset
} from './../core/entities/internal';


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
                let warehouse = applyRandomProperties(tenant, organization, countries);
                warehouse = await dataSource.manager.save(warehouse);
                for (let i = 0; i <= Math.floor(Math.random() * 2); i++) {
                    const product = faker.random.arrayElement(products);

                    let warehouseProduct = new WarehouseProduct();
                    warehouseProduct.product = product;
                    warehouseProduct.warehouse = warehouse;
                    warehouseProduct.tenant = tenant;
                    warehouseProduct.organization = organization;
                    warehouseProduct = await dataSource.manager.save(warehouseProduct);

                    let productsQuantity = 0;
                    for await (const variant of product.variants) {
                        const warehouseVariant = new WarehouseProductVariant();
                        warehouseVariant.tenant = tenant;
                        warehouseVariant.organization = organization;
                        warehouseVariant.variant = variant;
                        warehouseVariant.warehouseProduct = warehouseProduct;
                        warehouseVariant.quantity = faker.datatype.number(200);
                        productsQuantity += warehouseVariant.quantity;
                        await dataSource.manager.save(warehouseVariant);
                    }
                    warehouseProduct.quantity = productsQuantity;
                    await dataSource.manager.save(warehouseProduct);
                }
            }
        }
    }

}

const applyRandomProperties = (
    tenant: ITenant,
    organization: IOrganization,
    countries: ICountry[]
) => {
    const warehouse = new Warehouse()
    warehouse.name = faker.company.companyName();
    warehouse.code = faker.datatype.uuid();
    warehouse.email = faker.internet.exampleEmail(warehouse.name);
    warehouse.description = faker.lorem.words();
    warehouse.active = faker.datatype.boolean();
    warehouse.organization = organization;
    warehouse.tenant = tenant;

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

    warehouse.contact = contact;
    warehouse.logo = logo;

    return warehouse;
}