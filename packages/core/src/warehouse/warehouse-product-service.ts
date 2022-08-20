import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
	IPagination,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import {
	WarehouseProduct,
	WarehouseProductVariant,
	Product,
	Warehouse
} from './../core/entities/internal';

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

	async getAllWarehouseProducts(warehouseId: string): Promise<IWarehouseProduct[]> {
		return await this.warehouseProductRepository.find({
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
		let warehouse = await this.warehouseRepository.findOneBy({
			id: warehouseId,
			tenantId
		});
		let products = await this.productRespository.find({
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
		let warehouseProduct = await this.warehouseProductRepository.findOneBy({
			id: warehouseProductId as any
		});
		warehouseProduct.quantity = quantity;
		return this.warehouseProductRepository.save(warehouseProduct);
	}

	async updateWarehouseProductVariantQuantity(
		warehouseProductVariantId: string,
		quantity: number
	): Promise<IWarehouseProductVariant> {
		let warehouseProductVariant = await this.warehouseProductVariantRepository.findOne({
			where: {
				id: warehouseProductVariantId
			},
			relations: {
				warehouseProduct: true
			}
		});
		warehouseProductVariant.quantity = quantity;

		let updatedVariant = await this.warehouseProductVariantRepository.save(
			warehouseProductVariant
		);


		let warehouseProduct = await this.warehouseProductRepository.findOne({
			where: {
				id: warehouseProductVariant.warehouseProduct.id
			},
			relations: {
				variants: true
			}
		});
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
