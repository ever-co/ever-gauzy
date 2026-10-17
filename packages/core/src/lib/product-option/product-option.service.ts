import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { ProductOptionTranslation } from './../core/entities/internal';
import { IProductOptionTranslatable, IProductOptionTranslation } from '@gauzy/contracts';
import { ProductOption } from './product-option.entity';
import { TypeOrmProductOptionRepository } from './repository/type-orm-product-option.repository';
import { MikroOrmProductOptionRepository } from './repository/mikro-orm-product-option.repository';
import { TypeOrmProductOptionTranslationRepository } from './repository/type-orm-product-option-translation.repository';
import { assertTranslationsOfTenant } from './translation-ownership.helper';

@Injectable()
export class ProductOptionService extends TenantAwareCrudService<ProductOption> {
	constructor(
		readonly typeOrmProductOptionRepository: TypeOrmProductOptionRepository,
		readonly mikroOrmProductOptionRepository: MikroOrmProductOptionRepository,
		readonly typeOrmProductOptionTranslationRepository: TypeOrmProductOptionTranslationRepository
	) {
		super(typeOrmProductOptionRepository, mikroOrmProductOptionRepository);
	}

	async saveProductOptionTranslations(
		translationsInput: ProductOptionTranslation[]
	): Promise<ProductOptionTranslation[]> {
		await assertTranslationsOfTenant(
			this.typeOrmProductOptionTranslationRepository,
			translationsInput,
			this.typeOrmProductOptionRepository
		);
		return this.typeOrmProductOptionTranslationRepository.save(translationsInput);
	}

	async saveProductOptionTranslation(translationInput: ProductOptionTranslation): Promise<ProductOptionTranslation> {
		await assertTranslationsOfTenant(
			this.typeOrmProductOptionTranslationRepository,
			translationInput,
			this.typeOrmProductOptionRepository
		);
		return this.typeOrmProductOptionTranslationRepository.save(translationInput);
	}

	/**
	 * Delete multiple product options.
	 */
	async deleteBulk(productOptionsInput: IProductOptionTranslatable[]): Promise<void> {
		const ids = (productOptionsInput ?? [])
			.filter((o) => (o as ProductOption).id)
			.map((o) => (o as ProductOption).id);
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as any);
		}
	}

	async deleteOptionTranslationsBulk(productOptionTranslationsInput: IProductOptionTranslation[]) {
		await assertTranslationsOfTenant(
			this.typeOrmProductOptionTranslationRepository,
			productOptionTranslationsInput
		);
		return this.typeOrmProductOptionTranslationRepository.remove(productOptionTranslationsInput as any);
	}
}
