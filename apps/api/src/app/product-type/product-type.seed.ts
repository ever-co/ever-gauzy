import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductType } from './product-type.entity';
import * as seed from './product-type.seed.json';
import { ProductTypeTranslation } from './product-type-translation.entity';

export const createDefaultProductTypes = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ProductType[]> => {
	const seedProductTypes = [];

	organizations.forEach(async (organization) => {
		seed.forEach((seedProductType) => {
			const newType = new ProductType();

			newType.icon = seedProductType.icon;
			newType.organization = organization;
			newType.translations = [];

			seedProductType.translations.forEach((translation) => {
				const newTranslation = new ProductTypeTranslation();
				Object.assign(newTranslation, translation);
				newType.translations.push(newTranslation);
			});

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
