import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureModule, RolePermissionModule, SequenceModule, TenantSettingModule } from '@gauzy/core';
import { resolvers } from './graphql/resolvers';
import { GoodsReceiptLine } from './goods-receipt-line/goods-receipt-line.entity';
import { GoodsReceiptLineController } from './goods-receipt-line/goods-receipt-line.controller';
import { GoodsReceiptLineService } from './goods-receipt-line/goods-receipt-line.service';
import { MikroOrmGoodsReceiptLineRepository } from './goods-receipt-line/repository/mikro-orm-goods-receipt-line.repository';
import { TypeOrmGoodsReceiptLineRepository } from './goods-receipt-line/repository/type-orm-goods-receipt-line.repository';
import { GoodsReceipt } from './goods-receipt/goods-receipt.entity';
import { GoodsReceiptController } from './goods-receipt/goods-receipt.controller';
import { GoodsReceiptService } from './goods-receipt/goods-receipt.service';
import { MikroOrmGoodsReceiptRepository } from './goods-receipt/repository/mikro-orm-goods-receipt.repository';
import { TypeOrmGoodsReceiptRepository } from './goods-receipt/repository/type-orm-goods-receipt.repository';
import { PurchaseOrderLine } from './purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderLineController } from './purchase-order-line/purchase-order-line.controller';
import { PurchaseOrderLineService } from './purchase-order-line/purchase-order-line.service';
import { MikroOrmPurchaseOrderLineRepository } from './purchase-order-line/repository/mikro-orm-purchase-order-line.repository';
import { TypeOrmPurchaseOrderLineRepository } from './purchase-order-line/repository/type-orm-purchase-order-line.repository';
import { PurchaseOrder } from './purchase-order/purchase-order.entity';
import { PurchaseOrderController } from './purchase-order/purchase-order.controller';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { MikroOrmPurchaseOrderRepository } from './purchase-order/repository/mikro-orm-purchase-order.repository';
import { TypeOrmPurchaseOrderRepository } from './purchase-order/repository/type-orm-purchase-order.repository';
import { VendorProductTerm } from './vendor-product-term/vendor-product-term.entity';
import { VendorProductTermController } from './vendor-product-term/vendor-product-term.controller';
import { VendorProductTermService } from './vendor-product-term/vendor-product-term.service';
import { MikroOrmVendorProductTermRepository } from './vendor-product-term/repository/mikro-orm-vendor-product-term.repository';
import { TypeOrmVendorProductTermRepository } from './vendor-product-term/repository/type-orm-vendor-product-term.repository';

/** Every entity this plugin owns, in dependency order, as one array. */
export const ALL_PURCHASING_ENTITIES = [
	PurchaseOrder,
	PurchaseOrderLine,
	GoodsReceipt,
	GoodsReceiptLine,
	VendorProductTerm
];

/**
 * The purchasing domain's Nest wiring.
 *
 * Both ORMs are registered for every entity because the platform selects its ORM at boot, and the
 * paired repositories are providers rather than being constructed by the services — that pairing is
 * what lets the same service run on either.
 *
 * `FeatureModule` and `RolePermissionModule` are imported because the guards the controllers carry are
 * providers of *this* module: `FeatureFlagGuard` reads the feature service, and
 * `TenantPermissionGuard` / `PermissionGuard` read the role-permission service. Nest imports are not
 * inherited downwards, so importing them in a parent module would not be enough. `TenantSettingModule`
 * is imported for the receipt service, which reads the organization's standing over-receipt allowance
 * from the platform's settings.
 *
 * The inventory capability is deliberately **not** imported. It is reached through the
 * `PURCHASING_INVENTORY` injection token, which is what lets this package be installed without the
 * inventory tables and still refuse a receipt it cannot write movements for, rather than writing a
 * level itself.
 */
@Module({
	controllers: [
		PurchaseOrderController,
		PurchaseOrderLineController,
		GoodsReceiptController,
		GoodsReceiptLineController,
		VendorProductTermController
	],
	imports: [
		TypeOrmModule.forFeature(ALL_PURCHASING_ENTITIES),
		MikroOrmModule.forFeature(ALL_PURCHASING_ENTITIES),
		FeatureModule,
		RolePermissionModule,
		SequenceModule,
		TenantSettingModule
	],
	providers: [
		PurchaseOrderService,
		PurchaseOrderLineService,
		GoodsReceiptService,
		GoodsReceiptLineService,
		VendorProductTermService,
		TypeOrmPurchaseOrderRepository,
		MikroOrmPurchaseOrderRepository,
		TypeOrmPurchaseOrderLineRepository,
		MikroOrmPurchaseOrderLineRepository,
		TypeOrmGoodsReceiptRepository,
		MikroOrmGoodsReceiptRepository,
		TypeOrmGoodsReceiptLineRepository,
		MikroOrmGoodsReceiptLineRepository,
		TypeOrmVendorProductTermRepository,
		MikroOrmVendorProductTermRepository,
		// The GraphQL resolvers are providers here because they inject the same services the REST
		// controllers do; the plugin hands the composition pass the same classes through
		// `extensions.resolvers`, so there is one implementation per rule rather than one per surface.
		...resolvers
	],
	exports: [
		PurchaseOrderService,
		PurchaseOrderLineService,
		GoodsReceiptService,
		GoodsReceiptLineService,
		VendorProductTermService
	]
})
export class PurchasingModule {}
