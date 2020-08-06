import { Connection } from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { ProductType } from './product-type.entity';
import * as seed from './product-type.seed.json';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { Tenant } from '../tenant/tenant.entity';
import * as faker from 'faker';
import { ProductTypesIconsEnum } from '@gauzy/models';

export const createDefaultProductType = async (
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

export const createRandomProductType = async (
  connection: Connection,
  tenants: Tenant[],
  tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<ProductType[]> => {
  if (!tenantOrganizationsMap) {
    console.warn(
      'Warning: tenantOrganizationsMap not found, Random Product Type will not be created'
    );
    return;
  }

  const productTypes: ProductType[] = [];

  for (const tenant of tenants) {
    const tenantOrgs = tenantOrganizationsMap.get(tenant);
    for (const tenantOrg of tenantOrgs) {
      for (const seedProductType of seed) {
        const productType = new ProductType();

        productType.icon = seedProductType.icon;
        productType.organization = tenantOrg;
        productType.translations = [];

        seedProductType.translations.forEach((translation) => {
          const newTranslation = new ProductTypeTranslation();
          Object.assign(newTranslation, translation);
          productType.translations.push(newTranslation);
        });

        productTypes.push(productType);
      }
    }
  }

  await connection.manager.save(productTypes);

  return productTypes;
};
