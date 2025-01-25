import { Injectable } from '@nestjs/common';
import { ProductOptionGroupTranslation } from './../core/entities/internal';
import { TenantAwareCrudService } from './../core/crud';
import { IProductOptionGroupTranslation, IProductOptionGroupTranslatable } from '@gauzy/contracts';
import { ProductOptionGroup } from './product-option-group.entity';
import { MikroOrmProductOptionGroupRepository } from './repository/mikro-orm-product-option-group.repository';
import { TypeOrmProductOptionGroupRepository } from './repository/type-orm-product-option-group.repository';
import { TypeOrmProductOptionGroupTranslationRepository } from './repository/type-orm-product-option-group-translation.repository';

@Injectable()
export class ProductOptionGroupService extends TenantAwareCrudService<ProductOptionGroup> {
	constructor(
		typeOrmProductOptionGroupRepository: TypeOrmProductOptionGroupRepository,
		mikroOrmProductOptionGroupRepository: MikroOrmProductOptionGroupRepository,
		readonly typeOrmProductOptionGroupTranslationRepository: TypeOrmProductOptionGroupTranslationRepository
	) {
		super(typeOrmProductOptionGroupRepository, mikroOrmProductOptionGroupRepository);
	}

	async create(productOptionsGroupInput: ProductOptionGroup): Promise<ProductOptionGroup> {
		return this.typeOrmRepository.save(productOptionsGroupInput);
	}

	async createBulk(productOptionsGroupInput: ProductOptionGroup[]): Promise<ProductOptionGroup[]> {
		return this.typeOrmRepository.save(productOptionsGroupInput);
	}

	async saveBulk(productOptionsGroupInput: ProductOptionGroup[]): Promise<ProductOptionGroup[]> {
		return this.typeOrmRepository.save(productOptionsGroupInput);
	}

	async deleteBulk(productOptionGroupsInput: IProductOptionGroupTranslatable[]) {
		return this.typeOrmRepository.remove(productOptionGroupsInput as any);
	}

	async createTranslations(
		optionGroupTranslations: ProductOptionGroupTranslation[]
	): Promise<ProductOptionGroupTranslation[]> {
		return this.typeOrmProductOptionGroupTranslationRepository.save(optionGroupTranslations);
	}

	async createTranslation(
		optionGroupTranslation: ProductOptionGroupTranslation
	): Promise<ProductOptionGroupTranslation> {
		return this.typeOrmProductOptionGroupTranslationRepository.save(optionGroupTranslation);
	}

	async deleteGroupTranslationsBulk(productOptionGroupTranslationsInput: IProductOptionGroupTranslation[]) {
		return this.typeOrmProductOptionGroupTranslationRepository.remove(productOptionGroupTranslationsInput as any);
	}
}
