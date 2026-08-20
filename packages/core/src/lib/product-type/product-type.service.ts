import { Injectable, BadRequestException, HttpException } from '@nestjs/common';
import { ID, IPagination, IProductTypeTranslatable, LanguagesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum } from './../core/utils';
import { RequestContext } from './../core/context';
import { ProductType } from './product-type.entity';
import { MikroOrmProductTypeRepository } from './repository/mikro-orm-product-type.repository';
import { TypeOrmProductTypeRepository } from './repository/type-orm-product-type.repository';

@Injectable()
export class ProductTypeService extends TenantAwareCrudService<ProductType> {
	constructor(
		typeOrmProductTypeRepository: TypeOrmProductTypeRepository,
		mikroOrmProductTypeRepository: MikroOrmProductTypeRepository
	) {
		super(typeOrmProductTypeRepository, mikroOrmProductTypeRepository);
	}

	/**
	 * GET product types using pagination
	 *
	 * @param options
	 * @param language
	 * @returns
	 */
	public async pagination(options: BaseQueryDTO<ProductType>, language: LanguagesEnum) {
		const { items, total } = await super.paginate(options);
		return await this.mapTranslatedProductTypes(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * UPDATE product type
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	async updateProductType(id: ID, entity: ProductType): Promise<ProductType> {
		try {
			const tenantId = RequestContext.currentTenantId();

			// The update is a delete-then-recreate, and `translations` cascades on delete. Load the
			// current row (tenant-scoped, translations are eager) so the payload can be rebuilt under the
			// VERIFIED path id — never a body-supplied one, since a recreate with a foreign id would
			// write into another tenant's row — and so omitting `translations` does not erase them.
			// Throws NotFoundException when the row is not in the caller's tenant.
			const existing = await this.findOneByIdString(id);

			const payload = {
				...entity,
				id,
				...(isNotEmpty(tenantId) ? { tenantId } : {}),
				// A translation row is deleted with its parent, so the carried-over copies must be NEW
				// rows: keeping their old ids would make TypeORM issue an UPDATE that matches nothing.
				// `undefined`, not `isNotEmpty`: an explicit `translations: []` means "remove them", and
				// treating it as omitted would make the list impossible to clear.
				translations:
					entity?.translations !== undefined && entity?.translations !== null
						? entity.translations
					: (existing.translations ?? []).map(({ id: _translationId, ...translation }: any) => translation)
			};

			if (this.ormType === MultiORMEnum.TypeORM) {
				// The transactional manager below is raw: TenantAwareCrudService's create/save guards do not
				// run, so the ownership check has to be explicit here.
				await this.assertNotForeignRow({ id } as any, tenantId);
				return await this.typeOrmRepository.manager.transaction(async (transactionalEntityManager) => {
					// 1. Ensure delete is scoped to the current tenant
					await transactionalEntityManager.delete(ProductType, {
						id,
						...(isNotEmpty(tenantId) ? { tenantId } : {})
					});

					// 2. Save with an EXPLICIT entity target and a plain payload. The route validates with
					// `transform: true`, so `entity` is a ProductTypeDTO instance; EntityManager.save()
					// resolves metadata from the constructor and threw EntityMetadataNotFoundError for it —
					// rolling the transaction back and turning every update into a 400.
					return await transactionalEntityManager.save(ProductType, payload);
				});
			}
			await super.delete(id);
			// NOT `save()`: on MikroORM that is `upsert()`, which does not cascade relations, so the
			// rebuilt `translations` were silently dropped and the row came back with none. `create()`
			// goes through persistAndFlush, which does cascade.
			return await this.create(payload);
		} catch (err) {
			// Preserve intentional HTTP exceptions (404 above, ForbiddenException from the ownership guard)
			if (err instanceof HttpException) {
				throw err;
			}
			throw new BadRequestException(err);
		}
	}

	/**
	 * GET all product types
	 *
	 * @param options
	 * @param language
	 * @returns
	 */
	public async findProductTypes(
		options: BaseQueryDTO<ProductType>,
		language: LanguagesEnum
	): Promise<IPagination<ProductType>> {
		const { relations = [], where } = options;
		const { items, total } = await this.findAll({
			where,
			relations
		});
		return await this.mapTranslatedProductTypes(items as any, language).then((items) => {
			return { items, total };
		});
	}

	/**
	 * MAP product types translations
	 *
	 * @param items
	 * @param languageCode
	 * @returns
	 */
	async mapTranslatedProductTypes(items: IProductTypeTranslatable[], languageCode: LanguagesEnum) {
		if (languageCode) {
			return Promise.all(
				items.map((type: IProductTypeTranslatable) => Object.assign({}, type, type.translate(languageCode)))
			);
		} else {
			return items;
		}
	}

	/**
	 * MAP product type translations
	 *
	 * @param type
	 * @param languageCode
	 * @returns
	 */
	async mapTranslatedProductType(type: IProductTypeTranslatable, languageCode: LanguagesEnum) {
		try {
			if (languageCode) {
				return Object.assign({}, type, type.translate(languageCode));
			} else {
				return type;
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
