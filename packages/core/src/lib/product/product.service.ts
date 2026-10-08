import { FindManyOptions } from 'typeorm';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { Product } from './product.entity';
import { ProductTranslation } from './product-translation.entity';
import { TypeOrmProductRepository } from './repository/type-orm-product.repository';
import { MikroOrmProductRepository } from './repository/mikro-orm-product.repository';
import { TypeOrmProductTranslationRepository } from './repository/type-orm-product-translation.repository';

/** Largest page `findAllProducts` serves when paging is requested. */
export const MAX_PRODUCTS_PAGE_SIZE = 100;

/** Parses a paging query value as a positive integer, or `undefined` when it is not one. */
function toPositiveInteger(value: unknown): number | undefined {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

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
		options: { page?: number | string; limit?: number | string } = {}
	): Promise<IPagination<Product | IProductTranslated>> {
		const findOptions = {
			relations: relations,
			where: {
				...findInput
			}
		} as FindManyOptions<Product>;

		// Without any paging option, keep returning the whole list as before (API / MCP callers).
		// Otherwise paginate (`paginate` treats `skip` as a 1-based page) with a stable order, falling back
		// to page 1 / 10 items for invalid values and capping the page size.
		const isProvided = (value: unknown) => value !== undefined && value !== null && value !== '';
		const { items, total } =
			isProvided(options.page) || isProvided(options.limit)
				? await this.paginate({
						...findOptions,
						order: { createdAt: 'DESC', id: 'DESC' },
						skip: toPositiveInteger(options.page) ?? 1,
						take: Math.min(toPositiveInteger(options.limit) ?? 10, MAX_PRODUCTS_PAGE_SIZE)
				  } as FindManyOptions<Product>)
				: await this.findAll(findOptions);
		return await this.mapTranslatedProducts(items as any, langCode).then((items) => {
			return { items, total };
		});
	}

	async findByIdTranslated(
		langCode: string,
		id: string,
		relations?: string[]
	): Promise<Product | IProductTranslated> {
		return await this.findOneByOptions({
			where: { id: id },
			relations: relations
		}).then((result) => {
			if (result) {
				return result.translateNested(langCode, this.propsTranslate);
			}
			return result;
		});
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
