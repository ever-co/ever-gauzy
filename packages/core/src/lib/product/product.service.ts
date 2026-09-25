import { EntityManager, FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
	IImageAsset,
	IPagination,
	IProductCreateInput,
	IProductFindInput,
	IProductTranslatable,
	IProductTranslated,
	LanguagesEnum,
	TranslatePropertyInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context/request-context';
import { ApiErrorCode } from './../core/errors/api-error-codes';
import { operationOf } from './../api/bulk';
import { IBulkTransactionRunner } from './../api/bulk-executor.service';
import { Product } from './product.entity';
import { ProductTranslation } from './product-translation.entity';
import { IBulkProductItem } from './product.bulk';
import { TypeOrmProductRepository } from './repository/type-orm-product.repository';
import { MikroOrmProductRepository } from './repository/mikro-orm-product.repository';
import { TypeOrmProductTranslationRepository } from './repository/type-orm-product-translation.repository';

@Injectable()
export class ProductService extends TenantAwareCrudService<Product> {
	propsTranslate: TranslatePropertyInput[] = [
		{
			prop: 'root',
			propsTranslate: [
				{ key: 'name', alias: 'name' },
				{ key: 'description', alias: 'description' }
			]
		},
		{
			prop: 'productCategory',
			propsTranslate: [{ key: 'name', alias: 'productCategory' }]
		},
		{
			prop: 'productType',
			propsTranslate: [{ key: 'name', alias: 'productType' }]
		},
		{
			prop: 'description',
			propsTranslate: [{ key: 'description', alias: 'description' }]
		}
	];

	constructor(
		readonly typeOrmProductRepository: TypeOrmProductRepository,
		readonly mikroOrmProductRepository: MikroOrmProductRepository,
		readonly typeOrmProductTranslationRepository: TypeOrmProductTranslationRepository
	) {
		super(typeOrmProductRepository, mikroOrmProductRepository);
	}

	/**
	 * The transaction a bulk batch writes its items through.
	 *
	 * An atomic batch has to be one transaction, and only the resource knows which connection its own
	 * tables are written through, so the runner is the service's to state rather than the route's to
	 * assemble: the `.manager.transaction` path is the platform's, as it is everywhere else a group
	 * of writes has to commit or roll back together.
	 *
	 * It is a member rather than a method so it can be handed to the batch executor as it stands.
	 */
	public readonly transaction: IBulkTransactionRunner = (work) => this.typeOrmProductRepository.manager.transaction(work);

	public async pagination(filter: any, language: LanguagesEnum) {
		if ('where' in filter) {
			const { where } = filter;
			if ('languageCode' in where) {
				const { languageCode } = where;
				language = languageCode;

				delete where['languageCode'];
			}
		}
		const { items, total } = await super.paginate(filter);

		return await this.mapTranslatedProducts(items as any, language).then((items) => {
			return { items, total };
		});
	}

	public async findProducts(input: any, language: LanguagesEnum): Promise<IPagination<Product | IProductTranslated>> {
		const { relations = [], findInput } = input;
		const { items, total } = await this.findAll({
			where: {
				...findInput
			},
			relations
		});
		return await this.mapTranslatedProducts(items as any, language).then((items) => {
			return { items, total };
		});
	}

	async findAllProducts(
		langCode?: LanguagesEnum,
		relations?: string[],
		findInput?: IProductFindInput,
		options = { page: 1, limit: 10 }
	): Promise<IPagination<Product | IProductTranslated>> {
		const { items, total } = await this.findAll({
			relations: relations,
			where: {
				...findInput
			}
		} as FindManyOptions<Product>);
		return await this.mapTranslatedProducts(items as any, langCode).then((items) => {
			return { items, total };
		});
	}

	/**
	 * Reads one product, in one language, by the value that names it.
	 *
	 * The value is read the same way the delivery route reads it — as an identifier when it is one and
	 * as a slug otherwise — so the per-language reading of a product accepts exactly what the
	 * per-language route's sibling accepts, and the two readings of one row cannot diverge on which
	 * values name it.
	 *
	 * @param langCode The language the translation is merged for.
	 * @param idOrSlug The row's identifier, or its slug.
	 * @param relations The relations to load with the row.
	 * @returns The translated product.
	 */
	async findByIdTranslated(
		langCode: string,
		idOrSlug: string,
		relations?: string[]
	): Promise<Product | IProductTranslated> {
		return await this.findOneByOptions({
			where: this.idOrSlugWhere(idOrSlug),
			relations: relations
		}).then((result) => {
			if (result) {
				return result.translateNested(langCode, this.propsTranslate);
			}
			return result;
		});
	}

	/**
	 * Reads one product by the value that names it, as `GET /products/:idOrSlug` declares it.
	 *
	 * A value that parses as a UUID is the row's identifier and is read by it; anything else is the
	 * row's slug. One path carries both because they name the same row of the same resource, and a
	 * caller that holds the stable, human-readable slug should not have to look the identifier up
	 * first — the parameter is one value with two readings, not two routes.
	 *
	 * Both readings are tenant-scoped, because both go through the tenant-aware read: the identifier
	 * branch is the read the route performed before the slug was accepted at all, and the slug branch
	 * narrows the same way. A value that matches no product of the caller's scope is a miss whichever
	 * form it took, and it is answered with the platform's own code rather than the store's wording.
	 *
	 * @param idOrSlug The row's identifier, or its slug.
	 * @param options The relations to load and any further narrowing the caller states.
	 * @returns The product.
	 * @throws NotFoundException `RESOURCE_NOT_FOUND` when no product of the caller's scope matches.
	 */
	async findOneByIdOrSlug(idOrSlug: string, options: any = {}): Promise<Product> {
		try {
			return isUUID(idOrSlug)
				? await this.findOneByIdString(idOrSlug, options)
				: await this.findOneByOptions({
						...options,
						where: {
							...(options && options.where ? options.where : {}),
							slug: idOrSlug
						}
				  });
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw new NotFoundException(
					`${ApiErrorCode.RESOURCE_NOT_FOUND}: no product matches '${String(idOrSlug)}'.`
				);
			}

			throw error;
		}
	}

	/**
	 * The condition a stated identifier-or-slug narrows a read to.
	 *
	 * One place reads which of the two columns a value names, so every read that accepts both forms
	 * accepts the same values: a second reading would be a second answer to "does this value name a
	 * slug".
	 *
	 * @param idOrSlug The row's identifier, or its slug.
	 * @returns The condition the read narrows by.
	 */
	private idOrSlugWhere(idOrSlug: string): FindOptionsWhere<Product> {
		return isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
	}

	async findById(id: string, options: any): Promise<Product> {
		return await this.findOneByIdString(id, options);
	}

	async saveProduct(productRequest: IProductCreateInput): Promise<Product> {
		let res = await this.create(<any>productRequest);
		return await this.findOneByIdString(res.id, {
			relations: ['variants', 'optionGroups', 'productType', 'productCategory', 'tags', 'gallery']
		});
	}

	/**
	 * Applies one item of a bulk batch and answers the row it wrote.
	 *
	 * The item is the product's own write payload with the operation stated on top, so this is the
	 * write the single-item routes perform, reached with the members a batch carries: the row's own
	 * members as the item states them, the tags as the identifiers the pivot row is written from, and
	 * the translations as the rows the product cascades.
	 *
	 * **`manager` is what makes an atomic batch all-or-nothing.** An atomic batch hands every item the
	 * one manager its transaction opened, and an item written through any other handle would not be
	 * part of that transaction — it would survive the rollback the executor performs when a later item
	 * fails, and the guarantee the caller asked for would be a promise the platform does not keep. A
	 * batch that applies its items one by one hands each item the manager of that item's own
	 * transaction instead: the executor's `runOne` opens one per item whenever the route supplies a
	 * runner, and both product routes supply `transaction`, so an item that fails is rolled back alone
	 * rather than leaving part of its write behind. Only a batch the executor opens no transaction for
	 * states no manager — a dry run, or a route that supplies no runner.
	 *
	 * A row the item addresses is read through the tenant-scoped read before it is written, so a row
	 * another tenant owns is a miss rather than a write — the answer the single-item route gives — and
	 * a row that is not there is reported as that item's failure rather than as a batch that could not
	 * be read.
	 *
	 * The removal an item may name is the resource's archive: the row is withdrawn and kept, which is
	 * the removal the second protocol's `softDeleteProduct` performs. A batch is not the place for the
	 * destructive removal — the order lines that name a product keep resolving, and a caller that
	 * wants the row gone has the delivered route for exactly that.
	 *
	 * @param item The item: the operation and the product it applies to.
	 * @param manager The manager of the transaction the item is written in — the batch's on an atomic
	 * batch, the item's own otherwise — when the executor opened one.
	 * @returns The row the item wrote or archived.
	 */
	public async applyBulkItem(item: IBulkProductItem, manager?: EntityManager): Promise<Product> {
		const { tagIds, translations, ...members } = item;
		const op = operationOf(item);
		const payload = {
			...members,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {}),
			...(translations ? { translations } : {})
		};
		const repository: Repository<Product> = manager ? manager.getRepository(Product) : this.typeOrmProductRepository;

		if (op === 'delete') {
			return await repository.softRemove(await this.findOneByIdString(item.id));
		}

		if (op === 'update' || (op === 'upsert' && item.id)) {
			const product = await this.findOneByIdString(item.id);

			return await repository.save(Object.assign(product, payload) as Product);
		}

		// A row without an identifier is a row being written, so the tenant is stamped from the
		// credential; an identifier the item did state is refused when it names another tenant's row,
		// which is the guard the delivered create path applies for the same reason.
		const tenantId = RequestContext.currentTenantId();
		await this.assertNotForeignRow(payload, tenantId);

		return await repository.save(
			Object.assign(new Product(), { ...payload, tenant: { id: tenantId }, tenantId })
		);
	}

	async addGalleryImages(productId: string, images: IImageAsset[]): Promise<Product> {
		try {
			let product = await this.findOneByIdString(productId, {
				relations: ['gallery']
			});
			product.gallery = product.gallery.concat(images);
			return await this.save(product);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async setAsFeatured(productId: string, image: IImageAsset): Promise<Product> {
		try {
			let product = await this.findOneByIdString(productId);
			product.featuredImage = image;
			return await this.save(product);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async deleteGalleryImage(productId: string, imageId: string): Promise<Product> {
		try {
			let product = await this.findOneByIdString(productId, {
				relations: ['gallery', 'variants']
			});

			if (product.variants.find((variant) => variant.image.id == imageId)) {
				throw new HttpException('Image is used in product variants', HttpStatus.BAD_REQUEST);
			}

			product.gallery = product.gallery.filter((image) => image.id !== imageId);
			return await this.save(product);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async deleteFeaturedImage(productId: string): Promise<Product> {
		try {
			let product = await this.findOneByIdString(productId);
			product.featuredImage = null;
			return await this.save(product);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}

	async saveProductTranslation(productTranslation: ProductTranslation): Promise<ProductTranslation> {
		return await this.typeOrmProductTranslationRepository.save(productTranslation);
	}

	async mapTranslatedProducts(items: IProductTranslatable[], languageCode: LanguagesEnum) {
		if (languageCode) {
			return Promise.all(
				items.map((product: IProductTranslatable) =>
					Object.assign({}, product, product.translateNested(languageCode, this.propsTranslate))
				)
			);
		} else {
			return items;
		}
	}
}
