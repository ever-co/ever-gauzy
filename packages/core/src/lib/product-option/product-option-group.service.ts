import { Injectable } from '@nestjs/common';
import { In, FindOptionsWhere } from 'typeorm';
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

	async deleteBulk(productOptionGroupsInput: IProductOptionGroupTranslatable[]): Promise<void> {
		const ids = productOptionGroupsInput
			.filter((g): g is IProductOptionGroupTranslatable & { id: string } => 'id' in g && !!g.id)
			.map((g) => g.id);
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as FindOptionsWhere<ProductOptionGroup>);
		}
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
