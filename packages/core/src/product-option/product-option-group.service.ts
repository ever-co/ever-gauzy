import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { ProductOptionGroupTranslation } from './../core/entities/internal';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IProductOptionGroupTranslation, IProductOptionGroupTranslatable } from '@gauzy/contracts';
import { ProductOptionGroup } from './product-option-group.entity';

@Injectable()
export class ProductOptionGroupService extends TenantAwareCrudService<ProductOptionGroup> {
	constructor(
		@InjectRepository(ProductOptionGroup)
		productOptionGroupRepository: Repository<ProductOptionGroup>,
		@MikroInjectRepository(ProductOptionGroup)
		mikroProductOptionGroupRepository: EntityRepository<ProductOptionGroup>,

		@InjectRepository(ProductOptionGroupTranslation)
		private readonly productOptionGroupTranslationRepository: Repository<ProductOptionGroupTranslation>,

		@MikroInjectRepository(ProductOptionGroupTranslation)
		private readonly mikroProductOptionGroupTranslationRepository: EntityRepository<ProductOptionGroupTranslation>
	) {
		super(productOptionGroupRepository, mikroProductOptionGroupRepository);
	}

	async create(productOptionsGroupInput: ProductOptionGroup): Promise<ProductOptionGroup> {
		return this.repository.save(productOptionsGroupInput);
	}

	async createBulk(productOptionsGroupInput: ProductOptionGroup[]): Promise<ProductOptionGroup[]> {
		return this.repository.save(productOptionsGroupInput);
	}

	async saveBulk(productOptionsGroupInput: ProductOptionGroup[]): Promise<ProductOptionGroup[]> {
		return this.repository.save(productOptionsGroupInput);
	}

	async deleteBulk(productOptionGroupsInput: IProductOptionGroupTranslatable[]) {
		return this.repository.remove(productOptionGroupsInput as any);
	}

	async createTranslations(
		optionGroupTranslations: ProductOptionGroupTranslation[]
	): Promise<ProductOptionGroupTranslation[]> {
		return this.productOptionGroupTranslationRepository.save(optionGroupTranslations);
	}

	async createTranslation(
		optionGroupTranslation: ProductOptionGroupTranslation
	): Promise<ProductOptionGroupTranslation> {
		return this.productOptionGroupTranslationRepository.save(optionGroupTranslation);
	}

	async deleteGroupTranslationsBulk(productOptionGroupTranslationsInput: IProductOptionGroupTranslation[]) {
		return this.productOptionGroupTranslationRepository.remove(productOptionGroupTranslationsInput as any);
	}
}
