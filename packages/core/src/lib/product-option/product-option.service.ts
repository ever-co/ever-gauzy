import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { ProductOptionTranslation } from './../core/entities/internal';
import { IProductOptionTranslatable, IProductOptionTranslation } from '@gauzy/contracts';
import { ProductOption } from './product-option.entity';
import { TypeOrmProductOptionRepository } from './repository/type-orm-product-option.repository';
import { MikroOrmProductOptionRepository } from './repository/mikro-orm-product-option.repository';
import { TypeOrmProductOptionTranslationRepository } from './repository/type-orm-product-option-translation.repository';

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
		return this.typeOrmProductOptionTranslationRepository.save(translationsInput);
	}

	async saveProductOptionTranslation(translationInput: ProductOptionTranslation): Promise<ProductOptionTranslation> {
		return this.typeOrmProductOptionTranslationRepository.save(translationInput);
	}

	async save(productOptionInput: IProductOptionTranslatable): Promise<ProductOption> {
		return this.typeOrmRepository.save(productOptionInput);
	}

	async saveBulk(productOptionsInput: ProductOption[]): Promise<ProductOption[]> {
		return this.typeOrmRepository.save(productOptionsInput);
	}

	async deleteBulk(productOptionsInput: IProductOptionTranslatable[]) {
		return this.typeOrmRepository.remove(productOptionsInput as any);
	}

	async deleteOptionTranslationsBulk(productOptionTranslationsInput: IProductOptionTranslation[]) {
		return this.typeOrmProductOptionTranslationRepository.remove(productOptionTranslationsInput as any);
	}
}
