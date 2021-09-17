import { Connection } from 'typeorm';
import { ICountry, IOrganization, ITenant } from '@gauzy/contracts';
import { Country, Warehouse, Contact, Product, WarehouseProduct, WarehouseProductVariant, ImageAsset } from './../core/entities/internal';
import * as faker from 'faker';


export const createRandomWarehouses = async (
    connection: Connection,
    tenants: ITenant[],
    tenantOrganizationsMap: Map<ITenant, IOrganization[]>
) => {

    if (!tenantOrganizationsMap) {
        console.warn(
            'Warning: tenantOrganizationsMap not found, Product Warehouses will not be created'
        );
        return;
    }

    const countries: ICountry[] = await connection.manager.find(Country);
    const products = await connection.manager.find(Product, { relations: ['variants'] });

    let warehouses: Warehouse[] = [];

    for await (const tenant of tenants) {
        const organizations = tenantOrganizationsMap.get(tenant);
        for await (const organization of organizations) {
            for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
                const warehouse = applyRandomProperties(tenant, organization, countries);
                warehouse.products = [];

                for (let i = 0; i <= Math.floor(Math.random() * 2); i++) {
                    const warehouseProduct = new WarehouseProduct();
                    const product = faker.random.arrayElement(products);

                    warehouseProduct.product = product;
                    warehouseProduct.warehouse = warehouse;

                    const warehouseProductDb = await connection.manager.save(warehouseProduct);
                    let productsQuantity = 0;


                    await Promise.all(product.variants.map(async variant => {
                        const warehouseVariant = new WarehouseProductVariant();
                        warehouseVariant.variant = variant;
                        warehouseVariant.quantity = faker.datatype.number(200);
                        warehouseVariant.warehouseProduct = warehouseProductDb;
                        productsQuantity += warehouseVariant.quantity;

                        return await connection.manager.save(warehouseVariant);
                    }));

                    warehouseProduct.quantity = productsQuantity;
                    warehouse.products.push(warehouseProduct);
                }

                warehouse.organization = organization;
                warehouse.tenant = tenant;
                warehouses.push(warehouse);
            }
        }
    }
    await connection.manager.save(warehouses);

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