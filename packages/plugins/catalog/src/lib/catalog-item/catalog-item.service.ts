import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ID, LanguagesEnum } from '@gauzy/contracts';
import { Product, ProductTranslation, ProductVariant, RequestContext } from '@gauzy/core';
import { ICatalogItem } from '../catalog.types';

/**
 * One catalogue item, read by its identifier.
 *
 * A domain that references a product or a variant — a right granted over one, a plan that delivers
 * one — holds nothing but an identifier, and this is the read that turns it into something a person
 * can be shown. It answers with the catalogue's own row rather than with a projection of it: the
 * platform's `Product` and `ProductVariant` are the types such a caller publishes, and a two-field
 * copy would leave every other field of those types resolving to nothing.
 *
 * Three things are decided here and nowhere else in this class:
 *
 * 1. **The product's name is the translation for the language the caller asked for.** The name of a
 *    product is a row of `product_translation`, one per language, and the platform's rule — the one
 *    its REST and GraphQL surfaces already apply — is to merge the row whose `languageCode` matches
 *    the request, defaulting to English when the request states none. A product with no translation
 *    in that language has no name in it, which is a fact about the catalogue and not a gap to paper
 *    over with a translation in some other language.
 * 2. **A variant has no name, and none is borrowed for it.** Nothing in the catalogue names a
 *    variant: what the operator labels it with is its own `internalReference`, and what distinguishes
 *    it from its siblings is the options it carries. Answering with the product's name instead would
 *    be a wrong label on the right row, so the member is left absent.
 * 3. **An identifier that is not the caller's is not an identifier this answers for.** The read is
 *    scoped to the caller's tenant and organization, and a row outside that scope is reported as
 *    absent — the same answer as an identifier that names nothing.
 */
@Injectable()
export class CatalogItemService {
	constructor(
		@InjectRepository(Product)
		private readonly typeOrmProductRepository: Repository<Product>,
		@InjectRepository(ProductVariant)
		private readonly typeOrmProductVariantRepository: Repository<ProductVariant>
	) {}

	/**
	 * Reads one product.
	 *
	 * @param id The product to read.
	 * @returns The product, with its name and description in the caller's language merged onto it, or
	 * null when no such product is the caller's.
	 * @throws BadRequestException when no product was named.
	 */
	public async findProduct(id: ID): Promise<ICatalogItem | null> {
		if (!id) {
			throw new BadRequestException('CATALOG_PRODUCT_REQUIRED: a product is read by its identifier.');
		}

		const product = await this.typeOrmProductRepository.findOne({
			where: { id, ...this.scope() } as FindOptionsWhere<Product>,
			relations: { translations: true }
		});

		if (!product) {
			return null;
		}

		const translation = this.translationFor(product);

		// The row itself, with the identity the caller asked by and the translated members beside it: a
		// caller that publishes the catalogue's own product type finds every field of it here, and the
		// two members a caller without that type needs are the ones the contract names.
		return {
			...product,
			id: product.id,
			...(translation
				? { name: translation.name, description: translation.description ?? undefined }
				: {})
		};
	}

	/**
	 * Reads one variant.
	 *
	 * @param id The variant to read.
	 * @returns The variant, or null when no such variant is the caller's.
	 * @throws BadRequestException when no variant was named.
	 */
	public async findVariant(id: ID): Promise<ICatalogItem | null> {
		if (!id) {
			throw new BadRequestException('CATALOG_VARIANT_REQUIRED: a variant is read by its identifier.');
		}

		const variant = await this.typeOrmProductVariantRepository.findOne({
			where: { id, ...this.scope() } as FindOptionsWhere<ProductVariant>
		});

		return variant ? { ...variant, id: variant.id } : null;
	}

	/**
	 * The translation of a product in the language the caller asked for.
	 *
	 * @param product The product, with its translations loaded.
	 * @returns The matching translation, or undefined when the product has none in that language.
	 */
	private translationFor(product: Product): ProductTranslation | undefined {
		const language = this.languageOf();

		return (product.translations ?? []).find((translation) => translation.languageCode === language);
	}

	/**
	 * @returns The language the caller asked for, which is the platform's own rule: the request's
	 * `language` header, and English when the request states none.
	 */
	private languageOf(): LanguagesEnum {
		const header = RequestContext.currentRequest()?.headers?.['language'];

		return (Array.isArray(header) ? header[0] : header) || LanguagesEnum.ENGLISH;
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
