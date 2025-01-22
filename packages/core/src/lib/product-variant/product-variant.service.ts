import { BadRequestException, Injectable } from '@nestjs/common';
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
		const total = await this.typeOrmRepository.count();
		const items = await this.typeOrmRepository.find({
			relations: ['settings', 'price', 'image']
		});

		return { items, total };
	}

	async findAllVariantsByProductId(productId: string): Promise<IPagination<IProductVariant>> {
		const total = await this.typeOrmRepository.count();
		const items = await this.typeOrmRepository.find({
			relations: ['image'],
			where: { productId: productId }
		});

		return { items, total };
	}

	async findOne(id: string): Promise<ProductVariant> {
		return await this.typeOrmRepository.findOne({
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
		return this.typeOrmRepository.save(productVariants);
	}

	async createVariant(productVariant: ProductVariant): Promise<ProductVariant> {
		return this.typeOrmRepository.save(productVariant);
	}

	async updateVariant(productVariant: ProductVariant): Promise<ProductVariant> {
		return this.typeOrmRepository.save(productVariant);
	}

	async deleteMany(productVariants: ProductVariant[]): Promise<ProductVariant[]> {
		return this.typeOrmRepository.remove(productVariants);
	}

	async deleteFeaturedImage(id: string): Promise<IProductVariant> {
		try {
			let variant = await this.typeOrmRepository.findOneBy({
				id
			});
			variant.image = null;
			return await this.typeOrmRepository.save(variant);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
