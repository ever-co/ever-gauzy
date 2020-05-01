import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductType } from './product-type.entity';

export const createDefaultProductTypes = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ProductType[]> => {
	const productTypes: ProductType[] = [];

	//TODO: Get this from env ?
	organizations.forEach((organization) => {
		const productType1 = new ProductType();
		productType1.name = 'product type 1';
		productType1.organizationId = organization.id;
		productType1.organization = organization;
		productTypes.push(productType1);
	});

	await insertProductTypes(connection, productTypes);

	return productTypes;
};

const insertProductTypes = async (
	connection: Connection,
	productTypes: ProductType[]
): Promise<void> => {
	await connection.manager.save(productTypes);
};
