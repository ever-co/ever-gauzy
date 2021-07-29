import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { ProductOptionTranslation } from './../core/entities/internal';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IProductOptionTranslatable,
	IProductOptionTranslation
} from '@gauzy/contracts';
import { ProductOption } from './product-option.entity';

@Injectable()
export class ProductOptionService extends TenantAwareCrudService<ProductOption> {
	constructor(
		@InjectRepository(ProductOption)
		private readonly productOptionRepository: Repository<ProductOption>,
		@InjectRepository(ProductOptionTranslation)
		private readonly productOptionTranslationRepository: Repository<ProductOptionTranslation>
	) {
		super(productOptionRepository);
	}

	async saveProductOptionTranslations(
		translationsInput: ProductOptionTranslation[]
	): Promise<ProductOptionTranslation[]> {
		return this.productOptionTranslationRepository.save(translationsInput);
	}

	async saveProductOptionTranslation(
		translationInput: ProductOptionTranslation
	): Promise<ProductOptionTranslation> {
		return this.productOptionTranslationRepository.save(translationInput);
	}

	async save(
		productOptionInput: IProductOptionTranslatable
	): Promise<ProductOption> {
		return this.productOptionRepository.save(productOptionInput);
	}

	async saveBulk(
		productOptionsInput: ProductOption[]
	): Promise<ProductOption[]> {
		return this.productOptionRepository.save(productOptionsInput);
	}

	async deleteBulk(productOptionsInput: IProductOptionTranslatable[]) {
		return this.productOptionRepository.remove(productOptionsInput as any);
	}

	async deleteOptionTranslationsBulk(
		productOptionTranslationsInput: IProductOptionTranslation[]
	) {
		return this.productOptionTranslationRepository.remove(
			productOptionTranslationsInput as any
		);
	}
}
