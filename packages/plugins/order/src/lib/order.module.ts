import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AdjustmentModule, SequenceModule, TaxLineModule, RolePermissionModule } from '@gauzy/core';
import { CartModule } from '@gauzy/plugin-cart';
import { ALL_ORDER_ENTITIES } from './entities';
import { OrderController } from './order/order.controller';
import { OrderService } from './order/order.service';
import { TypeOrmOrderRepository } from './order/repository/type-orm-order.repository';
import { MikroOrmOrderRepository } from './order/repository/mikro-orm-order.repository';
import { OrderLineController } from './order-line/order-line.controller';
import { OrderLineService } from './order-line/order-line.service';
import { TypeOrmOrderLineRepository } from './order-line/repository/type-orm-order-line.repository';
import { MikroOrmOrderLineRepository } from './order-line/repository/mikro-orm-order-line.repository';
import { OrderLineInvoiceController } from './order-line-invoice/order-line-invoice.controller';
import { OrderLineInvoiceService } from './order-line-invoice/order-line-invoice.service';
import { TypeOrmOrderLineInvoiceRepository } from './order-line-invoice/repository/type-orm-order-line-invoice.repository';
import { MikroOrmOrderLineInvoiceRepository } from './order-line-invoice/repository/mikro-orm-order-line-invoice.repository';
import { OrderAddressController } from './order-address/order-address.controller';
import { OrderAddressService } from './order-address/order-address.service';
import { TypeOrmOrderAddressRepository } from './order-address/repository/type-orm-order-address.repository';
import { MikroOrmOrderAddressRepository } from './order-address/repository/mikro-orm-order-address.repository';
import { OrderShippingMethodController } from './order-shipping-method/order-shipping-method.controller';
import { OrderShippingMethodService } from './order-shipping-method/order-shipping-method.service';
import { TypeOrmOrderShippingMethodRepository } from './order-shipping-method/repository/type-orm-order-shipping-method.repository';
import { MikroOrmOrderShippingMethodRepository } from './order-shipping-method/repository/mikro-orm-order-shipping-method.repository';
import { OrderSummaryController } from './order-summary/order-summary.controller';
import { OrderSummaryService } from './order-summary/order-summary.service';
import { TypeOrmOrderSummaryRepository } from './order-summary/repository/type-orm-order-summary.repository';
import { MikroOrmOrderSummaryRepository } from './order-summary/repository/mikro-orm-order-summary.repository';
import { OrderTransactionController } from './order-transaction/order-transaction.controller';
import { OrderTransactionService } from './order-transaction/order-transaction.service';
import { TypeOrmOrderTransactionRepository } from './order-transaction/repository/type-orm-order-transaction.repository';
import { MikroOrmOrderTransactionRepository } from './order-transaction/repository/mikro-orm-order-transaction.repository';
import { OrderChangeController } from './order-change/order-change.controller';
import { OrderChangeService } from './order-change/order-change.service';
import { TypeOrmOrderChangeRepository } from './order-change/repository/type-orm-order-change.repository';
import { MikroOrmOrderChangeRepository } from './order-change/repository/mikro-orm-order-change.repository';
import { OrderChangeActionController } from './order-change-action/order-change-action.controller';
import { OrderChangeActionService } from './order-change-action/order-change-action.service';
import { TypeOrmOrderChangeActionRepository } from './order-change-action/repository/type-orm-order-change-action.repository';
import { MikroOrmOrderChangeActionRepository } from './order-change-action/repository/mikro-orm-order-change-action.repository';
import { OrderCreditLineController } from './order-credit-line/order-credit-line.controller';
import { OrderCreditLineService } from './order-credit-line/order-credit-line.service';
import { TypeOrmOrderCreditLineRepository } from './order-credit-line/repository/type-orm-order-credit-line.repository';
import { MikroOrmOrderCreditLineRepository } from './order-credit-line/repository/mikro-orm-order-credit-line.repository';
import { OrderHistoryController } from './order-history/order-history.controller';
import { OrderHistoryService } from './order-history/order-history.service';
import { TypeOrmOrderHistoryRepository } from './order-history/repository/type-orm-order-history.repository';
import { MikroOrmOrderHistoryRepository } from './order-history/repository/mikro-orm-order-history.repository';
import { OrderCheckoutHandler } from './checkout/order-checkout.handler';
import { OrderTotalsService } from './order-totals/order-totals.service';

/**
 * The order module.
 *
 * Every entity is registered with both ORMs from the one entity array, so the package cannot boot with a
 * table one ORM knows about and the other does not. Three core modules are imported because the order's
 * money and its number are *theirs*: the `adjustment` and `tax_line` modules own the ledgers the totals
 * are computed from, and the `sequence` module owns document numbering — an order number generated here
 * would be a second, divergent answer to a question the kernel already answers.
 *
 * The cart module is imported for one reason: completing a cart produces an order, and the handler that
 * does it must be able to read the cart it is completing. The dependency is one-way — the cart package
 * never imports this one.
 */
@Module({
	controllers: [
		OrderController,
		OrderLineController,
		OrderLineInvoiceController,
		OrderAddressController,
		OrderShippingMethodController,
		OrderSummaryController,
		OrderTransactionController,
		OrderChangeController,
		OrderChangeActionController,
		OrderCreditLineController,
		OrderHistoryController
	],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature(ALL_ORDER_ENTITIES),
		MikroOrmModule.forFeature(ALL_ORDER_ENTITIES),
		AdjustmentModule,
		TaxLineModule,
		SequenceModule,
		CartModule
	],
	providers: [
		OrderService,
		TypeOrmOrderRepository,
		MikroOrmOrderRepository,
		OrderTotalsService,
		OrderCheckoutHandler,
		OrderLineService,
		TypeOrmOrderLineRepository,
		MikroOrmOrderLineRepository,
		OrderLineInvoiceService,
		TypeOrmOrderLineInvoiceRepository,
		MikroOrmOrderLineInvoiceRepository,
		OrderAddressService,
		TypeOrmOrderAddressRepository,
		MikroOrmOrderAddressRepository,
		OrderShippingMethodService,
		TypeOrmOrderShippingMethodRepository,
		MikroOrmOrderShippingMethodRepository,
		OrderSummaryService,
		TypeOrmOrderSummaryRepository,
		MikroOrmOrderSummaryRepository,
		OrderTransactionService,
		TypeOrmOrderTransactionRepository,
		MikroOrmOrderTransactionRepository,
		OrderChangeService,
		TypeOrmOrderChangeRepository,
		MikroOrmOrderChangeRepository,
		OrderChangeActionService,
		TypeOrmOrderChangeActionRepository,
		MikroOrmOrderChangeActionRepository,
		OrderCreditLineService,
		TypeOrmOrderCreditLineRepository,
		MikroOrmOrderCreditLineRepository,
		OrderHistoryService,
		TypeOrmOrderHistoryRepository,
		MikroOrmOrderHistoryRepository
	],
	exports: [
		OrderService,
		OrderTotalsService,
		OrderChangeService,
		OrderLineService,
		OrderLineInvoiceService,
		OrderAddressService,
		OrderShippingMethodService,
		OrderSummaryService,
		OrderTransactionService,
		OrderCreditLineService,
		OrderHistoryService,
		OrderCheckoutHandler
	]
})
export class OrderModule {}
