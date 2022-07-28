import { DataSource } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { ProductOption } from './product-option.entity';
import { faker } from '@ever-co/faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductOptionGroup } from './product-option-group.entity';

export const createRandomProductOption = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfOptionPerProduct
): Promise<ProductOption[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Options will not be created'
		);
		return;
	}

	const productOptions: ProductOption[] = [];
	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await dataSource.manager.findBy(ProductCategory, {
				organizationId: tenantOrg.id
			});
			for (const productCategory of productCategories) {
				const products = await dataSource.manager.find(Product, {
					where: {
						productCategoryId: productCategory.id
					}
				});
				for (const product of products) {
					const productOptionGroups = await dataSource.manager.find(
						ProductOptionGroup, {
							where: {
								productId: product.id
							}
						}
					);
					for (let group of productOptionGroups) {
						for (let i = 0; i <= numberOfOptionPerProduct; i++) {
							const productOption = new ProductOption();

							productOption.name = faker.company.companyName();
							productOption.code = product.code;
							productOption.tenant = tenant;
							productOption.organization = tenantOrg;
							productOption.group = group;

							productOptions.push(productOption);
						}
					}
				}
			}
		}
	}
	return await dataSource.manager.save(productOptions);
};

export const createRandomProductOptionGroups = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfOptionGroupPerProduct
): Promise<ProductOptionGroup[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Options Groups will not be created'
		);
		return;
	}

	const productOptionGroups: ProductOptionGroup[] = [];
	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await dataSource.manager.find(ProductCategory, {
				where: {
					organizationId: tenantOrg.id
				}
			});
			for (const productCategory of productCategories) {
				const products = await dataSource.manager.find(Product, {
					where: {
						productCategoryId: productCategory.id
					}
				});
				for (const product of products) {
					for (let i = 0; i <= numberOfOptionGroupPerProduct; i++) {
						const productOptionGroup = new ProductOptionGroup();
						productOptionGroup.name = faker.company.companyName();
						productOptionGroup.tenant = tenant;
						productOptionGroup.organization = tenantOrg;
						productOptionGroup.product = product;
						productOptionGroups.push(productOptionGroup);
					}
				}
			}
		}
	}
	return await dataSource.manager.save(productOptionGroups);
};
