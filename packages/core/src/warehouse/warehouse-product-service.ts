import { Injectable } from '@nestjs/common';
import { CrudService } from '../core/crud/crud.service';
import {
	WarehouseProduct,
	WarehouseProductVariant,
	Product,
	Warehouse
} from 'core';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IWarehouseProductCreateInput } from '@gauzy/contracts';
import { AnyLengthString } from 'aws-sdk/clients/comprehendmedical';

@Injectable()
export class WarehouseProductService extends CrudService<WarehouseProduct> {
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

	async getAllWarehouseProducts(warehouseId: String) {
		return await this.warehouseProductRepository.find({
			where: { warehouse: { id: warehouseId } },
			relations: ['product']
		});
	}

	async createWarehouseProductBulk(
		warehouseProductCreateInput: IWarehouseProductCreateInput[],
		warehouseId: String
	) {
		let productIds = warehouseProductCreateInput.map((pr) => pr.productId);
		let warehouse = await this.warehouseRepository.findOne(
			warehouseId as AnyLengthString
		);

		let products = await this.productRespository.findByIds(productIds, {
			relations: ['variants']
		});

		let warehouseProductArr = [];

		products.forEach((product) => {
			let newWarehouseProduct = new WarehouseProduct();
			newWarehouseProduct.warehouse = warehouse;
			newWarehouseProduct.product = product;

			let warehouseVariants = product.variants.map((variant) => {
				let warehouseVariant = new WarehouseProductVariant();
				warehouseVariant.variant = variant;

				return warehouseVariant;
			});

			newWarehouseProduct.variants = warehouseVariants;
			warehouseProductArr.push(newWarehouseProduct);
		});

		let result: any = await this.warehouseProductRepository.save(
			warehouseProductArr
		);

		return { items: result, total: result ? result.length : 0 };
	}

	async updateWarehouseProductQuantity(quantity: number) {}
}
