import { DataSource, In } from 'typeorm';
import { BillingInvoicingPolicyEnum, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import * as _ from 'underscore';
import { ProductVariant } from './product-variant.entity';
import {
	Product,
	ProductCategory,
	ProductOption,
	ProductOptionGroup,
	ProductVariantPrice,
	ProductVariantSetting
} from './../core/entities/internal';

export const createRandomProductVariant = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfVariantPerProduct: number
) => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Variant will not be created'
		);
		return;
	}

	for await (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);

		for await (const organization of organizations) {
			const { id: organizationId } = organization;
			const productCategories = await dataSource.manager.findBy(ProductCategory, {
				organizationId,
				tenantId
			});

			for await (const productCategory of productCategories) {
				const products = await dataSource.manager.findBy(Product, {
					productCategoryId: productCategory.id
				});

				const productVariants: ProductVariant[] = [];
				for await (const product of products) {
					const productOptionGroups = await dataSource.manager.findBy(ProductOptionGroup, {
						productId: product.id
					});
					const productOptionGroupsIds = _.pluck(productOptionGroups, 'id');
					const productOptions = await dataSource.manager.find(ProductOption, {
						where: {
							group: In(productOptionGroupsIds),
						}
					}
					);
					for (let i = 0; i < numberOfVariantPerProduct; i++) {
						const productVariant = new ProductVariant();
						productVariant.notes = faker.person.jobDescriptor();
						productVariant.productId = product.id;
						productVariant.quantity = faker.number.int(20);
						productVariant.billingInvoicingPolicy = faker.helpers.arrayElement(
							Object.keys(BillingInvoicingPolicyEnum)
						);
						productVariant.enabled = faker.datatype.boolean();
						productVariant.options = productOptions;
						productVariant.setting = new ProductVariantSetting();
						productVariant.price = new ProductVariantPrice();
						productVariant.product = product;
						productVariant.tenant = tenant;
						productVariant.organization = organization;

						productVariants.push(productVariant);
					}
				}
				await dataSource.manager.save(productVariants);
			}
		}
	}
};
