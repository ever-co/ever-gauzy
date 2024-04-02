import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { IPagination, IWarehouseProduct, IWarehouseProductCreateInput, IWarehouseProductVariant } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { WarehouseProduct, WarehouseProductVariant, Product, Warehouse } from './../core/entities/internal';
import { TypeOrmWarehouseProductVariantRepository } from './repository/type-orm-warehouse-product-variant.repository';
import { MikroOrmWarehouseProductRepository } from './repository/mikro-orm-warehouse-product.repository ';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';
import { MikroOrmWarehouseProductVariantRepository } from './repository/mikro-orm-warehouse-product-variant.repository';
import { TypeOrmWarehouseProductRepository } from './repository/type-orm-warehouse-product.repository ';
import { TypeOrmProductRepository } from './../product/repository/type-orm-product.repository';
import { MikroOrmProductRepository } from './../product/repository/mikro-orm-product.repository';

@Injectable()
export class WarehouseProductService extends TenantAwareCrudService<WarehouseProduct> {
	constructor(
		@InjectRepository(WarehouseProduct)
		typeOrmWarehouseProductRepository: TypeOrmWarehouseProductRepository,

		mikroOrmWarehouseProductRepository: MikroOrmWarehouseProductRepository,

		@InjectRepository(Warehouse)
		private typeOrmWarehouseRepository: TypeOrmWarehouseRepository,

		mikroOrmWarehouseRepository: MikroOrmWarehouseRepository,

		@InjectRepository(WarehouseProductVariant)
		private typeOrmWarehouseProductVariantRepository: TypeOrmWarehouseProductVariantRepository,

		mikroOrmWarehouseProductVariantRepository: MikroOrmWarehouseProductVariantRepository,

		@InjectRepository(Product)
		private typeOrmProductRepository: TypeOrmProductRepository,

		mikroOrmProductRepository: MikroOrmProductRepository,
	) {
		super(typeOrmWarehouseProductRepository, mikroOrmWarehouseProductRepository);
	}

	/**
	 *
	 * @param warehouseId
	 * @returns
	 */
	async getAllWarehouseProducts(warehouseId: string): Promise<IWarehouseProduct[]> {
		return await this.typeOrmRepository.find({
			where: {
				warehouseId,
				tenantId: RequestContext.currentTenantId()
			},
			relations: {
				product: true,
				variants: {
					variant: true
				}
			}
		});
	}

	async createWarehouseProductBulk(
		warehouseProductCreateInput: IWarehouseProductCreateInput[],
		warehouseId: string
	): Promise<IPagination<IWarehouseProduct[]>> {
		let productIds = warehouseProductCreateInput.map((pr) => pr.productId);
		const tenantId = RequestContext.currentTenantId();
		let warehouse = await this.typeOrmWarehouseRepository.findOneBy({
			id: warehouseId,
			tenantId
		});
		let products = await this.typeOrmProductRepository.find({
			where: {
				id: In(productIds),
				tenantId
			},
			relations: {
				variants: true
			}
		});
		let warehouseProductArr = await Promise.all(
			products.map(async (product) => {
				let newWarehouseProduct = new WarehouseProduct();
				newWarehouseProduct.warehouse = warehouse;
				newWarehouseProduct.product = product;
				newWarehouseProduct.organizationId = warehouse.organizationId;
				newWarehouseProduct.tenantId = tenantId;

				let warehouseVariants = await Promise.all(
					product.variants.map(async (variant) => {
						let warehouseVariant = new WarehouseProductVariant();
						warehouseVariant.variant = variant;

						warehouseVariant.organizationId = warehouse.organizationId;
						warehouseVariant.tenantId = tenantId;

						return this.typeOrmWarehouseProductVariantRepository.save(warehouseVariant);
					})
				);

				newWarehouseProduct.variants = warehouseVariants;
				return newWarehouseProduct;
			})
		);

		let result: any = await this.typeOrmRepository.save(warehouseProductArr);

		return { items: result, total: result ? result.length : 0 };
	}

	async updateWarehouseProductQuantity(warehouseProductId: String, quantity: number): Promise<IWarehouseProduct> {
		let warehouseProduct = await this.typeOrmRepository.findOneBy({
			id: warehouseProductId as any
		});
		warehouseProduct.quantity = quantity;
		return this.typeOrmRepository.save(warehouseProduct);
	}

	async updateWarehouseProductVariantQuantity(
		warehouseProductVariantId: string,
		quantity: number
	): Promise<IWarehouseProductVariant> {
		let warehouseProductVariant = await this.typeOrmWarehouseProductVariantRepository.findOne({
			where: {
				id: warehouseProductVariantId
			},
			relations: {
				warehouseProduct: true
			}
		});
		warehouseProductVariant.quantity = quantity;

		let updatedVariant = await this.typeOrmWarehouseProductVariantRepository.save(warehouseProductVariant);

		let warehouseProduct = await this.typeOrmRepository.findOne({
			where: {
				id: warehouseProductVariant.warehouseProduct.id
			},
			relations: {
				variants: true
			}
		});
		let sumQuantity = warehouseProduct.variants.map((v) => +v.quantity).reduce((prev, current) => prev + current);

		if (warehouseProduct.quantity < sumQuantity) {
			warehouseProduct.quantity = +warehouseProduct.quantity + sumQuantity - warehouseProduct.quantity;
		}

		await this.typeOrmRepository.save(warehouseProduct);
		return updatedVariant;
	}
}
