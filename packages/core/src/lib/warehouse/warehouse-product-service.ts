import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
	ID,
	IPagination,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { RequestContext } from './../core/context/request-context';
import { WarehouseProduct, WarehouseProductVariant } from './../core/entities/internal';
import { ProductService } from '../product/product.service';
import { TypeOrmWarehouseProductVariantRepository } from './repository/type-orm-warehouse-product-variant.repository';
import { MikroOrmWarehouseProductRepository } from './repository/mikro-orm-warehouse-product.repository ';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { TypeOrmWarehouseProductRepository } from './repository/type-orm-warehouse-product.repository ';

@Injectable()
export class WarehouseProductService extends TenantAwareCrudService<WarehouseProduct> {
	constructor(
		readonly typeOrmWarehouseProductRepository: TypeOrmWarehouseProductRepository,
		readonly mikroOrmWarehouseProductRepository: MikroOrmWarehouseProductRepository,
		private readonly typeOrmWarehouseRepository: TypeOrmWarehouseRepository,
		private readonly typeOrmWarehouseProductVariantRepository: TypeOrmWarehouseProductVariantRepository,
		private readonly _productService: ProductService
	) {
		super(typeOrmWarehouseProductRepository, mikroOrmWarehouseProductRepository);
	}

	/**
	 * Retrieves all warehouse products for a given warehouse.
	 *
	 * @param {ID} warehouseId - The ID of the warehouse to fetch products from.
	 * @returns {Promise<IWarehouseProduct[]>} - A list of warehouse products.
	 */
	async getAllWarehouseProducts(warehouseId: ID): Promise<IWarehouseProduct[]> {
		const tenantId = RequestContext.currentTenantId();

		// Fetch all warehouse products
		const warehouseProducts = await this.typeOrmRepository.find({
			where: { warehouseId, tenantId },
			relations: {
				product: true,
				variants: { variant: true }
			}
		});

		return warehouseProducts;
	}

	/**
	 * Creates multiple warehouse products in bulk.
	 *
	 * @param {IWarehouseProductCreateInput[]} warehouseProductCreateInput - Array of warehouse product input data.
	 * @param {ID} warehouseId - The ID of the warehouse where products will be added.
	 * @returns {Promise<IPagination<IWarehouseProduct[]>>} - The created warehouse products with pagination metadata.
	 *
	 * @throws {NotFoundException} If warehouse or products are not found.
	 *
	 * @description
	 * 1. Fetches the warehouse and related products based on provided input.
	 * 2. Creates warehouse products and their variants in bulk.
	 * 3. Saves and returns the created records.
	 */
	async createWarehouseProductBulk(
		warehouseProductCreateInput: IWarehouseProductCreateInput[],
		warehouseId: ID
	): Promise<IPagination<IWarehouseProduct>> {
		const tenantId = RequestContext.currentTenantId();

		// Extract product IDs from input
		const productIds = warehouseProductCreateInput.map((pr) => pr.productId);

		// Fetch warehouse
		const warehouse = await this.typeOrmWarehouseRepository.findOneBy({ id: warehouseId, tenantId });
		if (!warehouse) {
			throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
		}

		// Fetch products with variants
		const products = await this._productService.find({
			where: { id: In(productIds), tenantId },
			relations: { variants: true }
		});

		if (!products.length) {
			throw new NotFoundException('No matching products found');
		}
		// Create warehouse products in bulk
		const warehouseProducts = products.map((product) => {
			const newWarehouseProduct = new WarehouseProduct();
			newWarehouseProduct.warehouse = warehouse;
			newWarehouseProduct.product = product;
			newWarehouseProduct.organizationId = warehouse.organizationId;
			newWarehouseProduct.tenantId = tenantId;

			// Create warehouse product variants in bulk
			newWarehouseProduct.variants = product.variants.map((variant) => {
				const warehouseVariant = new WarehouseProductVariant();
				warehouseVariant.variant = variant;
				warehouseVariant.organizationId = warehouse.organizationId;
				warehouseVariant.tenantId = tenantId;
				return warehouseVariant;
			});

			return newWarehouseProduct;
		});

		// Save warehouse product variants first
		await this.typeOrmWarehouseProductVariantRepository.save(warehouseProducts.flatMap((wp) => wp.variants));

		// Save warehouse products
		const result = await this.typeOrmRepository.save(warehouseProducts);

		return { items: result, total: result.length };
	}

	/**
	 * Updates the quantity of a warehouse product.
	 *
	 * @param {ID} warehouseProductId - The ID of the warehouse product to update.
	 * @param {number} quantity - The new quantity to be set.
	 * @returns {Promise<IWarehouseProduct>} - The updated warehouse product.
	 *
	 * @throws {NotFoundException} If the warehouse product is not found.
	 *
	 * @description
	 * 1. Fetches the warehouse product by its ID.
	 * 2. Updates the quantity field.
	 * 3. Saves and returns the updated record.
	 */
	async updateWarehouseProductQuantity(warehouseProductId: ID, quantity: number): Promise<IWarehouseProduct> {
		// Fetch warehouse product
		const warehouseProduct = await this.typeOrmRepository.findOneBy({ id: warehouseProductId });

		// Handle missing warehouse product
		if (!warehouseProduct) {
			throw new NotFoundException(`Warehouse product with ID ${warehouseProductId} not found`);
		}

		// Update and save warehouse product quantity
		warehouseProduct.quantity = quantity;
		return await this.typeOrmRepository.save(warehouseProduct);
	}

	/**
	 * Updates the quantity of a warehouse product variant and synchronizes the total quantity.
	 *
	 * @param {ID} warehouseProductVariantId - The ID of the warehouse product variant to update.
	 * @param {number} quantity - The new quantity to be set.
	 * @returns {Promise<IWarehouseProductVariant>} - The updated warehouse product variant.
	 *
	 * @throws {NotFoundException} If the warehouse product variant or its associated warehouse product is not found.
	 *
	 * @description
	 * 1. Updates the `quantity` of the specified warehouse product variant.
	 * 2. Fetches the associated warehouse product and updates its total quantity.
	 * 3. Saves the updated records to the database.
	 */
	async updateWarehouseProductVariantQuantity(
		warehouseProductVariantId: ID,
		quantity: number
	): Promise<IWarehouseProductVariant> {
		// Fetch the warehouse product variant along with its associated warehouse product
		const warehouseProductVariant = await this.typeOrmWarehouseProductVariantRepository.findOne({
			where: { id: warehouseProductVariantId },
			relations: { warehouseProduct: true }
		});

		if (!warehouseProductVariant) {
			throw new NotFoundException('Warehouse product variant not found');
		}

		// Update variant quantity
		warehouseProductVariant.quantity = quantity;
		const updatedVariant = await this.typeOrmWarehouseProductVariantRepository.save(warehouseProductVariant);

		// Fetch the associated warehouse product with all its variants
		const warehouseProduct = await this.typeOrmRepository.findOne({
			where: { id: warehouseProductVariant.warehouseProduct?.id },
			relations: { variants: true }
		});

		if (!warehouseProduct) {
			throw new NotFoundException('Warehouse product not found');
		}

		// Calculate total quantity of all variants
		const sumQuantity = warehouseProduct.variants?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0;

		// Adjust total warehouse product quantity
		if (warehouseProduct.quantity < sumQuantity) {
			warehouseProduct.quantity = sumQuantity;
		}

		// Save updated warehouse product
		await this.typeOrmRepository.save(warehouseProduct);

		return updatedVariant;
	}
}
