import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductType } from './product-type.entity';

export const createProductTypes = async (
	connection: Connection,
	organization: Organization
): Promise<ProductType[]> => {
	const productTypes = [];

	const productType1 = new ProductType();
	productType1.name = 'product type 1';
	productType1.organizationId = organization.id;
	productTypes.push(productType1);

	const productType2 = new ProductType();
	productType2.name = 'product type 2';
	productType2.organizationId = organization.id;
	productTypes.push(productType2);

	const productType3 = new ProductType();
	productType3.name = 'product type 3';
	productType3.organizationId = organization.id;
	productTypes.push(productType3);

	insertProductType(connection, productType1);
	insertProductType(connection, productType2);
	insertProductType(connection, productType3);

	return productTypes;
};

const insertProductType = async (
	connection: Connection,
	Type: ProductType
): Promise<void> => {
	await connection.manager.save(Type);
};
