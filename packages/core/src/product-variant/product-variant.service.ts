import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Repository } from 'typeorm';
import { IPagination, IProductVariant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductVariant } from './product-variant.entity';

@Injectable()
export class ProductVariantService extends TenantAwareCrudService<ProductVariant> {
	constructor(
		@InjectRepository(ProductVariant)
		productVariantRepository: Repository<ProductVariant>,
		@MikroInjectRepository(ProductVariant)
		mikroProductVariantRepository: EntityRepository<ProductVariant>
	) {
		super(productVariantRepository, mikroProductVariantRepository);
	}

	async findAllProductVariants(): Promise<IPagination<IProductVariant>> {
		const total = await this.repository.count();
		const items = await this.repository.find({
			relations: ['settings', 'price', 'image']
		});

		return { items, total };
	}

	async findAllVariantsByProductId(productId: string): Promise<IPagination<IProductVariant>> {
		const total = await this.repository.count();
		const items = await this.repository.find({
			relations: ['image'],
			where: { productId: productId }
		});

		return { items, total };
	}

	async findOne(id: string): Promise<ProductVariant> {
		return await this.repository.findOne({
			where: {
				id: id
			},
			relations: {
				setting: true,
				price: true,
				image: true
			}
		});
	}

	async createBulk(productVariants: ProductVariant[]): Promise<ProductVariant[]> {
		return this.repository.save(productVariants);
	}

	async createVariant(productVariant: ProductVariant): Promise<ProductVariant> {
		return this.repository.save(productVariant);
	}

	async updateVariant(productVariant: ProductVariant): Promise<ProductVariant> {
		return this.repository.save(productVariant);
	}

	async deleteMany(productVariants: ProductVariant[]): Promise<ProductVariant[]> {
		return this.repository.remove(productVariants);
	}

	async deleteFeaturedImage(id: string): Promise<IProductVariant> {
		try {
			let variant = await this.repository.findOneBy({
				id
			});
			variant.image = null;
			return await this.repository.save(variant);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
