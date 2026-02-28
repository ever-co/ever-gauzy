import { BadRequestException, Injectable } from '@nestjs/common';
import { In, FindOptionsWhere } from 'typeorm';
import { IPagination, IProductVariant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { ProductVariant } from './product-variant.entity';
import { MikroOrmProductVariantRepository } from './repository/mikro-orm-product-variant.repository';
import { TypeOrmProductVariantRepository } from './repository/type-orm-product-variant.repository';

@Injectable()
export class ProductVariantService extends TenantAwareCrudService<ProductVariant> {
	constructor(
		typeOrmProductVariantRepository: TypeOrmProductVariantRepository,
		mikroOrmProductVariantRepository: MikroOrmProductVariantRepository
	) {
		super(typeOrmProductVariantRepository, mikroOrmProductVariantRepository);
	}

	async findAllProductVariants(): Promise<IPagination<IProductVariant>> {
		return this.findAll({
			relations: ['settings', 'price', 'image']
		});
	}

	async findAllVariantsByProductId(productId: string): Promise<IPagination<IProductVariant>> {
		return this.findAll({
			relations: ['image'],
			where: { productId: productId }
		});
	}

	async findOne(id: string): Promise<ProductVariant> {
		return await this.findOneByIdString(id, {
			relations: {
				setting: true,
				price: true,
				image: true
			}
		});
	}

	async createBulk(productVariants: ProductVariant[]): Promise<ProductVariant[]> {
		return await this.saveMany(productVariants);
	}

	async createVariant(productVariant: ProductVariant): Promise<ProductVariant> {
		return this.save(productVariant);
	}

	async updateVariant(productVariant: ProductVariant): Promise<ProductVariant> {
		return this.save(productVariant);
	}

	async deleteManyVariants(productVariants: ProductVariant[]): Promise<ProductVariant[]> {
		const ids = productVariants.map((v) => v.id).filter((id): id is string => !!id);
		if (ids.length > 0) {
			const entities = await this.find({
				where: {
					id: In(ids)
				} as FindOptionsWhere<ProductVariant>,
				relations: {
					warehouseProductVariants: true
				}
			});
			await this.deleteMany(ids);
			return entities;
		}
		return [];
	}

	async deleteFeaturedImage(id: string): Promise<IProductVariant> {
		try {
			const variant = await this.findOneByIdString(id);
			variant.image = null;
			return await this.save(variant);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
