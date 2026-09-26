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
				items.map((type: IProductTypeTranslatable) =>
					Object.assign({}, type, this.translateRow(type, languageCode))
				)
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
				return Object.assign({}, type, this.translateRow(type, languageCode));
			} else {
				return type;
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * One row the CRUD base answered, with the requested language merged onto it.
	 *
	 * **The merge is the entity's, whichever ORM answered the row.** On TypeORM the row is a `ProductType` and
	 * carries `translate`, and that call is made exactly as it always was. On MikroORM the CRUD base answers
	 * `wrap(entity).toJSON()` — the row's data as a plain object, without the entity's prototype — so calling the
	 * method on the row failed with `type.translate is not a function` whenever a language was merged: a 500 from
	 * `GET /product-types`, `GET /product-types/pagination` and the GraphQL `productTypes` field, and a 400 from
	 * `POST /product-types` and `createProductType`, whose command merges the row `create()` answered — serialized
	 * too — and wraps what it catches. The same merge is therefore run on the serialized row, as `ProductType`'s
	 * own method.
	 *
	 * The row is handed to it as it stands. The merge reads nothing of the row but `translations` — loaded eagerly, and
	 * answered by both ORMs as the array of the row's translations — so no relation the read did not load is ever
	 * dereferenced; and it mutates the row it is called on, as it mutates the TypeORM entity, which is what the
	 * callers' `Object.assign` relies on to leave the merged `translations` out of the answer.
	 *
	 * @param row The row, as the CRUD base answered it.
	 * @param languageCode The language to merge.
	 * @returns What `translate` answers for the row.
	 */
	private translateRow(row: IProductTypeTranslatable, languageCode: string): any {
		if (typeof row.translate === 'function') {
			return row.translate(languageCode);
		}

		return ProductType.prototype.translate.call(row, languageCode);
	}
}
