/**
 * NestJS module of the ledger engine.
 *
 * The engine is the write path other aggregates call, never a resource that writes a quantity of its
 * own, and the level it maintains is a resource its callers read and reconcile through. The engine is
 * exported so every aggregate that changes stock injects it instead of writing a level row directly.
 */
import { Module } from '@nestjs/common';
import { EventBusModule, RolePermissionModule } from '@gauzy/core';
import { StockLevelController } from './stock-level.controller';
import { StockLevelService } from './stock-level.service';
import { StockLevelResolver } from '../graphql/stock-level.resolver';

@Module({
	controllers: [StockLevelController],
	imports: [RolePermissionModule, EventBusModule],
	providers: [StockLevelService, StockLevelResolver],
	exports: [StockLevelService]
})
export class StockLevelModule {}
