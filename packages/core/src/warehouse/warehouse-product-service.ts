import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import {
	WarehouseProduct,
	WarehouseProductVariant,
	Product,
	Warehouse
} from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
	IPagination,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant
} from '@gauzy/contracts';

@Injectable()
export class WarehouseProductService extends TenantAwareCrudService<WarehouseProduct> {
	constructor(
		@InjectRepository(Warehouse)
		private readonly warehouseRepository: Repository<Warehouse>,

		@InjectRepository(WarehouseProduct)
		private readonly warehouseProductRepository: Repository<WarehouseProduct>,

		@InjectRepository(WarehouseProductVariant)
		private readonly warehouseProductVariantRepository: Repository<WarehouseProductVariant>,

		@InjectRepository(Product)
		private readonly productRespository: Repository<Product>
	) {
		super(warehouseProductRepository);
	}

	async getAllWarehouseProducts(warehouseId: String): Promise<IWarehouseProduct[]> {
		return await this.warehouseProductRepository.find({
			where: { warehouse: { id: warehouseId } },
			relations: ['product', 'variants', 'variants.variant']
		});
	}

	async createWarehouseProductBulk(
		warehouseProductCreateInput: IWarehouseProductCreateInput[],
		warehouseId: String
	): Promise<IPagination<IWarehouseProduct[]>> {
		let productIds = warehouseProductCreateInput.map((pr) => pr.productId);
		let warehouse = await this.warehouseRepository.findOne(
			warehouseId as any
		);

		let products = await this.productRespository.findByIds(productIds, {
			relations: ['variants']
		});

		let warehouseProductArr = await Promise.all(
			products.map(async (product) => {
				let newWarehouseProduct = new WarehouseProduct();
				newWarehouseProduct.warehouse = warehouse;
				newWarehouseProduct.product = product;

				let warehouseVariants = await Promise.all(
					product.variants.map(async (variant) => {
						let warehouseVariant = new WarehouseProductVariant();
						warehouseVariant.variant = variant;

						return this.warehouseProductVariantRepository.save(
							warehouseVariant
						);
					})
				);

				newWarehouseProduct.variants = warehouseVariants;
				return newWarehouseProduct;
			})
		);

		let result: any = await this.warehouseProductRepository.save(
			warehouseProductArr
		);

		return { items: result, total: result ? result.length : 0 };
	}

	async updateWarehouseProductQuantity(
		warehouseProductId: String,
		quantity: number
	): Promise<IWarehouseProduct> {
		let warehouseProduct = await this.warehouseProductRepository.findOne(
			warehouseProductId as any
		);

		warehouseProduct.quantity = quantity;
		return this.warehouseProductRepository.save(warehouseProduct);
	}

	async updateWarehouseProductVariantQuantity(
		warehouseProductVariantId: String,
		quantity: number
	): Promise<IWarehouseProductVariant> {
		let warehouseProductVariant = await this.warehouseProductVariantRepository.findOne(
			warehouseProductVariantId as any,
			{ relations: ['warehouseProduct'] }
		);

		warehouseProductVariant.quantity = quantity;

		let updatedVariant = await this.warehouseProductVariantRepository.save(
			warehouseProductVariant
		);

		let warehouseProduct = await this.warehouseProductRepository.findOne(
			warehouseProductVariant.warehouseProduct.id,
			{
				relations: ['variants']
			}
		);

		let sumQuantity = warehouseProduct.variants
			.map((v) => +v.quantity)
			.reduce((prev, current) => prev + current);

		if (warehouseProduct.quantity < sumQuantity) {
			warehouseProduct.quantity =
				+warehouseProduct.quantity +
				sumQuantity -
				warehouseProduct.quantity;
		}

		await this.warehouseProductRepository.save(warehouseProduct);

		return updatedVariant;
	}
}
