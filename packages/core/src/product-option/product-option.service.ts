import { Injectable } from '@nestjs/common';
import { CrudService, ProductOptionTranslation } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IProductOption } from '@gauzy/contracts';
import { ProductOption } from './product-option.entity';

@Injectable()
export class ProductOptionService extends CrudService<ProductOption> {
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

	async save(productOptionInput: ProductOption): Promise<ProductOption> {
		return this.productOptionRepository.save(productOptionInput);
	}

	async saveBulk(
		productOptionsInput: ProductOption[]
	): Promise<ProductOption[]> {
		return this.productOptionRepository.save(productOptionsInput);
	}

	async deleteBulk(productOptionsInput: IProductOption[]) {
		return this.productOptionRepository.remove(productOptionsInput as any);
	}
}
