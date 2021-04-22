import { Injectable } from '@nestjs/common';
import { CrudService, ProductOptionGroupTranslation } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IProductOptionGroupTranslation,
	IProductOptionGroupTranslatable
} from '@gauzy/contracts';
import { ProductOptionGroup } from './product-option-group.entity';

@Injectable()
export class ProductOptionGroupService extends CrudService<ProductOptionGroup> {
	constructor(
		@InjectRepository(ProductOptionGroup)
		private readonly productOptionGroupRepository: Repository<ProductOptionGroup>,
		@InjectRepository(ProductOptionGroupTranslation)
		private readonly productOptionGroupTranslationRepository: Repository<ProductOptionGroupTranslation>
	) {
		super(productOptionGroupRepository);
	}

	async create(
		productOptionsGroupInput: ProductOptionGroup
	): Promise<ProductOptionGroup> {
		return this.productOptionGroupRepository.save(productOptionsGroupInput);
	}

	async createBulk(
		productOptionsGroupInput: ProductOptionGroup[]
	): Promise<ProductOptionGroup[]> {
		return this.productOptionGroupRepository.save(productOptionsGroupInput);
	}

	async saveBulk(
		productOptionsGroupInput: ProductOptionGroup[]
	): Promise<ProductOptionGroup[]> {
		return this.productOptionGroupRepository.save(productOptionsGroupInput);
	}

	async deleteBulk(
		productOptionGroupsInput: IProductOptionGroupTranslatable[]
	) {
		return this.productOptionGroupRepository.remove(
			productOptionGroupsInput as any
		);
	}

	async createTranslations(
		optionGroupTranslations: ProductOptionGroupTranslation[]
	): Promise<ProductOptionGroupTranslation[]> {
		return this.productOptionGroupTranslationRepository.save(
			optionGroupTranslations
		);
	}

	async createTranslation(
		optionGroupTranslation: ProductOptionGroupTranslation
	): Promise<ProductOptionGroupTranslation> {
		return this.productOptionGroupTranslationRepository.save(
			optionGroupTranslation
		);
	}

	async deleteGroupTranslationsBulk(
		productOptionGroupTranslationsInput: IProductOptionGroupTranslation[]
	) {
		return this.productOptionGroupTranslationRepository.remove(
			productOptionGroupTranslationsInput as any
		);
	}
}
