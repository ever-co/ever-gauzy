import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { Product, ProductVariant, ProductVariantSetting, RequestContext } from '@gauzy/core';

/**
 * How a variant is sold: whether it is offered on recurring terms, and which variant represents its
 * product when a caller names only the product.
 *
 * Both answers are already recorded in the platform's own tables and neither is derived here:
 *
 * - **`product_variant_setting.isSubscription`** is the mark that says a variant may be sold on a
 *   recurring basis. It is a setting of the variant, written by whoever authors the variant, and this
 *   service reads it rather than re-deciding what "sellable on a recurring basis" means. A variant
 *   with no settings row at all has never been marked, so it is not subscribable — the absence of the
 *   row is an answer, not a missing one.
 * - **`product_variant.isDefault`** is the variant a product is offered as when it is named without
 *   one. At most one variant per product carries it, which is what the filtered unique index on the
 *   column enforces, so the answer is a read of the operator's own choice and not a guess at one. A
 *   product whose variants none of them carry the mark answers with nothing rather than with the
 *   first row a query happened to return.
 *
 * Whether a product or a variant is the caller's at all is a third question, answered by an existence read: a plan
 * may be drafted on a variant of the caller's own catalogue before the variant is marked as sellable on recurring
 * terms, so "is it the caller's" and "may it be sold on recurring terms" are not the same read.
 *
 * Every read is scoped to the caller's tenant and organization, like every other read of this
 * package: a variant of another tenant is not found, and a caller cannot learn that it exists.
 *
 * The class owns no table, writes nothing, and adds no rule to the ones the columns already carry.
 */
@Injectable()
export class ProductVariantSaleService {
	constructor(
		@InjectRepository(ProductVariant)
		private readonly typeOrmProductVariantRepository: Repository<ProductVariant>,
		@InjectRepository(ProductVariantSetting)
		private readonly typeOrmProductVariantSettingRepository: Repository<ProductVariantSetting>,
		@InjectRepository(Product)
		private readonly typeOrmProductRepository: Repository<Product>
	) {}

	/**
	 * Whether a variant is one of the caller's.
	 *
	 * @param variantId The variant to read.
	 * @returns True when the caller's organization holds the variant.
	 * @throws BadRequestException when no variant was named.
	 */
	public async variantExists(variantId: ID): Promise<boolean> {
		if (!variantId) {
			throw new BadRequestException('CATALOG_VARIANT_REQUIRED: a variant is read by its identifier.');
		}

		const variant = await this.typeOrmProductVariantRepository.findOne({
			select: { id: true },
			where: { id: variantId, ...this.scope() } as FindOptionsWhere<ProductVariant>
		});

		return !!variant;
	}

	/**
	 * Whether a product is one of the caller's.
	 *
	 * @param productId The product to read.
	 * @returns True when the caller's organization holds the product.
	 * @throws BadRequestException when no product was named.
	 */
	public async productExists(productId: ID): Promise<boolean> {
		if (!productId) {
			throw new BadRequestException('CATALOG_PRODUCT_REQUIRED: a product is read by its identifier.');
		}

		const product = await this.typeOrmProductRepository.findOne({
			select: { id: true },
			where: { id: productId, ...this.scope() } as FindOptionsWhere<Product>
		});

		return !!product;
	}

	/**
	 * Whether a variant is marked as sellable on a recurring basis.
	 *
	 * @param variantId The variant to read.
	 * @returns True when the variant's settings mark it as a subscription variant.
	 * @throws BadRequestException when no variant was named.
	 */
	public async isVariantSubscribable(variantId: ID): Promise<boolean> {
		if (!variantId) {
			throw new BadRequestException('CATALOG_VARIANT_REQUIRED: a variant is read by its identifier.');
		}

		const setting = await this.typeOrmProductVariantSettingRepository.findOne({
			where: {
				productVariant: { id: variantId },
				...this.scope()
			} as FindOptionsWhere<ProductVariantSetting>
		});

		return setting?.isSubscription === true;
	}

	/**
	 * The variant a product is offered as when it is named without one.
	 *
	 * @param productId The product to read.
	 * @returns The marked variant's identifier, or null when no variant of the product carries the mark.
	 * @throws BadRequestException when no product was named.
	 */
	public async defaultVariantOf(productId: ID): Promise<ID | null> {
		if (!productId) {
			throw new BadRequestException('CATALOG_PRODUCT_REQUIRED: a product is read by its identifier.');
		}

		const variant = await this.typeOrmProductVariantRepository.findOne({
			where: {
				productId,
				isDefault: true,
				...this.scope()
			} as FindOptionsWhere<ProductVariant>
		});

		return variant?.id ?? null;
	}

	/**
	 * @returns The tenant and organization every read here is scoped to.
	 */
	private scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}
}
