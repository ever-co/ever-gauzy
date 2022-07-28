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
		private readonly productVariantRepository: Repository<ProductVariant>
	) {
		super(productVariantRepository);
	}

	async findAllProductVariants(): Promise<IPagination<IProductVariant>> {
		const total = await this.productVariantRepository.count();
		const items = await this.productVariantRepository.find({
			relations: ['settings', 'price', 'image']
		});

		return { items, total };
	}

	async findAllVariantsByProductId(productId: string): Promise<IPagination<IProductVariant>> {
		const total = await this.productVariantRepository.count();
		const items = await this.productVariantRepository.find({
			relations: ['image'],
			where: {'productId' : productId}
		});

		return { items, total };
	}

	async findOne(id: string): Promise<ProductVariant> {
		return await this.productVariantRepository.findOne({
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

	async createBulk(
		productVariants: ProductVariant[]
	): Promise<ProductVariant[]> {
		return this.productVariantRepository.save(productVariants);
	}

	async createVariant(
		productVariant: ProductVariant
	): Promise<ProductVariant> {
		return this.productVariantRepository.save(productVariant);
	}

	async updateVariant(
		productVariant: ProductVariant
	): Promise<ProductVariant> {
		return this.productVariantRepository.save(productVariant);
	}

	deleteMany(productVariants: ProductVariant[]): Promise<ProductVariant[]> {
		return this.productVariantRepository.remove(productVariants);
	}

	async deleteFeaturedImage(id: string): Promise<IProductVariant> {
		try {
			let variant = await this.productVariantRepository.findOneBy({
				id
			});
			variant.image = null;
			return await this.productVariantRepository.save(variant);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
