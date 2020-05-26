import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductType } from './product-type.entity';
import { environment as env } from '@env-api/environment';

export const createDefaultProductTypes = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ProductType[]> => {
	const seedProductTypes = [];

	organizations.forEach(async (organization) => {
		env.defaultProductTypes.forEach((seedProductType) => {
			const newType = new ProductType();
			newType.name = seedProductType.name;
			newType.description = seedProductType.description;
			newType.icon = seedProductType.icon;
			newType.organization = organization;
			seedProductTypes.push(newType);
		});
	});

	await insertProductTypes(connection, seedProductTypes);

	return seedProductTypes;
};

const insertProductTypes = async (
	connection: Connection,
	productTypes: ProductType[]
): Promise<void> => {
	await connection.manager.save(productTypes);
};
