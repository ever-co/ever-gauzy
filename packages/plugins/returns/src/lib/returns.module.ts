import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureModule, RolePermissionModule, SequenceModule } from '@gauzy/core';
import { resolvers } from './graphql/resolvers';
import { OrderClaimLine } from './order-claim-line/order-claim-line.entity';
import { OrderClaimLineController } from './order-claim-line/order-claim-line.controller';
import { OrderClaimLineService } from './order-claim-line/order-claim-line.service';
import { MikroOrmOrderClaimLineRepository } from './order-claim-line/repository/mikro-orm-order-claim-line.repository';
import { TypeOrmOrderClaimLineRepository } from './order-claim-line/repository/type-orm-order-claim-line.repository';
import { OrderClaim } from './order-claim/order-claim.entity';
import { OrderClaimController } from './order-claim/order-claim.controller';
import { OrderClaimService } from './order-claim/order-claim.service';
import { MikroOrmOrderClaimRepository } from './order-claim/repository/mikro-orm-order-claim.repository';
import { TypeOrmOrderClaimRepository } from './order-claim/repository/type-orm-order-claim.repository';
import { OrderExchangeLine } from './order-exchange-line/order-exchange-line.entity';
import { OrderExchangeLineController } from './order-exchange-line/order-exchange-line.controller';
import { OrderExchangeLineService } from './order-exchange-line/order-exchange-line.service';
import { MikroOrmOrderExchangeLineRepository } from './order-exchange-line/repository/mikro-orm-order-exchange-line.repository';
import { TypeOrmOrderExchangeLineRepository } from './order-exchange-line/repository/type-orm-order-exchange-line.repository';
import { OrderExchange } from './order-exchange/order-exchange.entity';
import { OrderExchangeController } from './order-exchange/order-exchange.controller';
import { OrderExchangeService } from './order-exchange/order-exchange.service';
import { MikroOrmOrderExchangeRepository } from './order-exchange/repository/mikro-orm-order-exchange.repository';
import { TypeOrmOrderExchangeRepository } from './order-exchange/repository/type-orm-order-exchange.repository';
import { OrderReturnLine } from './order-return-line/order-return-line.entity';
import { OrderReturnLineController } from './order-return-line/order-return-line.controller';
import { OrderReturnLineService } from './order-return-line/order-return-line.service';
import { MikroOrmOrderReturnLineRepository } from './order-return-line/repository/mikro-orm-order-return-line.repository';
import { TypeOrmOrderReturnLineRepository } from './order-return-line/repository/type-orm-order-return-line.repository';
import { OrderReturnReason } from './order-return-reason/order-return-reason.entity';
import { OrderReturnReasonController } from './order-return-reason/order-return-reason.controller';
import { OrderReturnReasonService } from './order-return-reason/order-return-reason.service';
import { MikroOrmOrderReturnReasonRepository } from './order-return-reason/repository/mikro-orm-order-return-reason.repository';
import { TypeOrmOrderReturnReasonRepository } from './order-return-reason/repository/type-orm-order-return-reason.repository';
import { OrderReturn } from './order-return/order-return.entity';
import { OrderReturnController } from './order-return/order-return.controller';
import { OrderReturnService } from './order-return/order-return.service';
import { MikroOrmOrderReturnRepository } from './order-return/repository/mikro-orm-order-return.repository';
import { TypeOrmOrderReturnRepository } from './order-return/repository/type-orm-order-return.repository';

/** Every entity this plugin owns, in dependency order, as one array. */
export const ALL_RETURNS_ENTITIES = [
	OrderReturnReason,
	OrderReturn,
	OrderReturnLine,
	OrderClaim,
	OrderClaimLine,
	OrderExchange,
	OrderExchangeLine
];

/**
 * The returns domain's Nest wiring.
 *
 * Both ORMs are registered for every entity because the platform selects its ORM at boot, and the
 * paired repositories are providers rather than being constructed by the services — that pairing is
 * what lets the same service run on either.
 *
 * Three capabilities are reached through optional injection tokens rather than imported modules: the
 * stock ledger, the refund gateway, the order's fulfilled quantities and the return-leg shipping
 * capability all belong to other domains. Registering a provider under one of those tokens is what
 * enables the corresponding behaviour, and the services refuse the operation rather than guessing
 * when a capability they need is absent.
 */
@Module({
	controllers: [
		OrderReturnController,
		OrderReturnLineController,
		OrderReturnReasonController,
		OrderClaimController,
		OrderClaimLineController,
		OrderExchangeController,
		OrderExchangeLineController
	],
	imports: [
		TypeOrmModule.forFeature(ALL_RETURNS_ENTITIES),
		MikroOrmModule.forFeature(ALL_RETURNS_ENTITIES),
		// Every controller here is `@UseGuards(..., FeatureFlagGuard)`: the guard is a provider of
		// this module, so this module is what has to import the feature service it reads.
		FeatureModule,
		RolePermissionModule,
		SequenceModule
	],
	providers: [
		OrderReturnService,
		OrderReturnLineService,
		OrderReturnReasonService,
		OrderClaimService,
		OrderClaimLineService,
		OrderExchangeService,
		OrderExchangeLineService,
		TypeOrmOrderReturnRepository,
		MikroOrmOrderReturnRepository,
		TypeOrmOrderReturnLineRepository,
		MikroOrmOrderReturnLineRepository,
		TypeOrmOrderReturnReasonRepository,
		MikroOrmOrderReturnReasonRepository,
		TypeOrmOrderClaimRepository,
		MikroOrmOrderClaimRepository,
		TypeOrmOrderClaimLineRepository,
		MikroOrmOrderClaimLineRepository,
		TypeOrmOrderExchangeRepository,
		MikroOrmOrderExchangeRepository,
		TypeOrmOrderExchangeLineRepository,
		MikroOrmOrderExchangeLineRepository,
		// The GraphQL resolvers are providers here because they inject the same services the REST
		// controllers do; the plugin hands the composition pass the same classes through
		// `extensions.resolvers`, so there is one implementation per rule rather than one per surface.
		...resolvers
	],
	exports: [
		OrderReturnService,
		OrderReturnLineService,
		OrderReturnReasonService,
		OrderClaimService,
		OrderClaimLineService,
		OrderExchangeService,
		OrderExchangeLineService
	]
})
export class ReturnsModule {}
