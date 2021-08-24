import { Connection, In } from 'typeorm';
import { BillingInvoicingPolicyEnum, IOrganization, ITenant } from '@gauzy/contracts';
import * as faker from 'faker';
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
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfVariantPerProduct
): Promise<ProductVariant[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Variant will not be created'
		);
		return;
	}

	const productVariants: ProductVariant[] = [];
	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await connection.manager.find(
				ProductCategory,
				{
					where: { organization: tenantOrg }
				}
			);
			for (const productCategory of productCategories) {
				const products = await connection.manager.find(Product, {
					where: { productCategory: productCategory }
				});
				for (const product of products) {
					const productOptionGroups = await connection.manager.find(ProductOptionGroup, {
							where: { product: product }
						}
					);
					const productOptionGroupsIds = _.pluck(productOptionGroups, 'id');
					const productOptions = await connection.manager.find(ProductOption, {
							where: { 
								group: In(productOptionGroupsIds),
							}
						}
					);
					for (let i = 0; i < numberOfVariantPerProduct; i++) {
						const productVariant = new ProductVariant();
						productVariant.notes = faker.name.jobDescriptor();
						productVariant.productId = product.id;
						productVariant.quantity = faker.datatype.number(20);
						productVariant.billingInvoicingPolicy = faker.random.arrayElement(
							Object.keys(BillingInvoicingPolicyEnum)
						);
						productVariant.enabled = faker.datatype.boolean();
						productVariant.options = productOptions;
						productVariant.setting = new ProductVariantSetting();
						productVariant.price = new ProductVariantPrice();
						productVariant.product = product;
						productVariant.tenant = tenant;
						productVariant.organization = tenantOrg;

						productVariants.push(productVariant);
					}
				}
			}
		}
	}

	return await connection.manager.save(productVariants);
};
