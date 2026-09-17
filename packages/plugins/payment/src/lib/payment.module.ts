import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule, Payment, RolePermissionModule } from '@gauzy/core';
import { PaymentProvider } from './payment-provider/payment-provider.entity';
import { PaymentCollection } from './payment-collection/payment-collection.entity';
import { PaymentSession } from './payment-session/payment-session.entity';
import { PaymentCapture } from './payment-capture/payment-capture.entity';
import { Refund } from './refund/refund.entity';
import { RefundLine } from './refund-line/refund-line.entity';
import { RefundReason } from './refund-reason/refund-reason.entity';
import { PaymentWebhookEvent } from './payment-webhook-event/payment-webhook-event.entity';
import { PaymentProviderService } from './payment-provider/payment-provider.service';
import { PaymentCollectionService } from './payment-collection/payment-collection.service';
import { PaymentSessionService } from './payment-session/payment-session.service';
import { PaymentCaptureService } from './payment-capture/payment-capture.service';
import { RefundService } from './refund/refund.service';
import { RefundLineService } from './refund-line/refund-line.service';
import { RefundReasonService } from './refund-reason/refund-reason.service';
import { PaymentWebhookEventService } from './payment-webhook-event/payment-webhook-event.service';
import { PaymentProviderController } from './payment-provider/payment-provider.controller';
import { PaymentCollectionController } from './payment-collection/payment-collection.controller';
import { PaymentSessionController } from './payment-session/payment-session.controller';
import { PaymentCaptureController } from './payment-capture/payment-capture.controller';
import { RefundController } from './refund/refund.controller';
import { RefundLineController } from './refund-line/refund-line.controller';
import { RefundReasonController } from './refund-reason/refund-reason.controller';
import { PaymentWebhookEventController } from './payment-webhook-event/payment-webhook-event.controller';
import { TypeOrmPaymentProviderRepository } from './payment-provider/repository/type-orm-payment-provider.repository';
import { MikroOrmPaymentProviderRepository } from './payment-provider/repository/mikro-orm-payment-provider.repository';
import { TypeOrmPaymentCollectionRepository } from './payment-collection/repository/type-orm-payment-collection.repository';
import { MikroOrmPaymentCollectionRepository } from './payment-collection/repository/mikro-orm-payment-collection.repository';
import { TypeOrmPaymentSessionRepository } from './payment-session/repository/type-orm-payment-session.repository';
import { MikroOrmPaymentSessionRepository } from './payment-session/repository/mikro-orm-payment-session.repository';
import { TypeOrmPaymentCaptureRepository } from './payment-capture/repository/type-orm-payment-capture.repository';
import { MikroOrmPaymentCaptureRepository } from './payment-capture/repository/mikro-orm-payment-capture.repository';
import { TypeOrmRefundRepository } from './refund/repository/type-orm-refund.repository';
import { MikroOrmRefundRepository } from './refund/repository/mikro-orm-refund.repository';
import { TypeOrmRefundLineRepository } from './refund-line/repository/type-orm-refund-line.repository';
import { MikroOrmRefundLineRepository } from './refund-line/repository/mikro-orm-refund-line.repository';
import { TypeOrmRefundReasonRepository } from './refund-reason/repository/type-orm-refund-reason.repository';
import { MikroOrmRefundReasonRepository } from './refund-reason/repository/mikro-orm-refund-reason.repository';
import { TypeOrmPaymentWebhookEventRepository } from './payment-webhook-event/repository/type-orm-payment-webhook-event.repository';
import { MikroOrmPaymentWebhookEventRepository } from './payment-webhook-event/repository/mikro-orm-payment-webhook-event.repository';
import { resolvers } from './graphql/resolvers';

/**
 * Every table this package owns, declared once.
 *
 * The array is the single source of the plugin's entity list and of the module's ORM registration,
 * because two lists are how an entity comes to be mapped by one ORM and not the other, and the
 * application then fails at boot with a metadata error that names neither.
 */
export const ALL_PAYMENT_ENTITIES = [
	PaymentProvider,
	PaymentCollection,
	PaymentSession,
	PaymentCapture,
	Refund,
	RefundLine,
	RefundReason,
	PaymentWebhookEvent
];

/**
 * The NestJS module of the payment domain.
 *
 * Every entity is registered with both ORMs, because an installation selects its ORM at boot and an
 * entity only one of them knows is a table no repository can reach. The repositories are providers
 * rather than bare `Repository<T>` injections, so a service depends on one class under either ORM.
 *
 * The core **`payment`** entity is registered here as well, and deliberately: this package maintains
 * the four lifecycle amounts and the derived status of a payment row in the same transaction that
 * writes the capture or the refund that caused them, and it reads the row to check the two capture
 * limits against it. The row itself belongs to core — the extension is the kernel's — so nothing is
 * redeclared, only reached.
 *
 * The services are exported because the order, returns and subscription domains consume the payment
 * lifecycle through them rather than through their own copy of it. `EventBusModule` is imported
 * because the services publish the six payment events the subscription surface offers through the
 * platform bus rather than through a private one, which is what lets a subscriber outside this
 * package hear them.
 */
@Module({
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature([...ALL_PAYMENT_ENTITIES, Payment]),
		MikroOrmModule.forFeature(ALL_PAYMENT_ENTITIES),
		EventBusModule
	],
	controllers: [
		PaymentProviderController,
		PaymentCollectionController,
		PaymentSessionController,
		PaymentCaptureController,
		RefundController,
		RefundLineController,
		RefundReasonController,
		PaymentWebhookEventController
	],
	providers: [
		PaymentProviderService,
		PaymentCollectionService,
		PaymentSessionService,
		PaymentCaptureService,
		RefundService,
		RefundLineService,
		RefundReasonService,
		PaymentWebhookEventService,
		TypeOrmPaymentProviderRepository,
		MikroOrmPaymentProviderRepository,
		TypeOrmPaymentCollectionRepository,
		MikroOrmPaymentCollectionRepository,
		TypeOrmPaymentSessionRepository,
		MikroOrmPaymentSessionRepository,
		TypeOrmPaymentCaptureRepository,
		MikroOrmPaymentCaptureRepository,
		TypeOrmRefundRepository,
		MikroOrmRefundRepository,
		TypeOrmRefundLineRepository,
		MikroOrmRefundLineRepository,
		TypeOrmRefundReasonRepository,
		MikroOrmRefundReasonRepository,
		TypeOrmPaymentWebhookEventRepository,
		MikroOrmPaymentWebhookEventRepository,
		...resolvers
	],
	exports: [
		PaymentProviderService,
		PaymentCollectionService,
		PaymentSessionService,
		PaymentCaptureService,
		RefundService,
		RefundLineService,
		RefundReasonService,
		PaymentWebhookEventService
	]
})
export class PaymentModule {}
