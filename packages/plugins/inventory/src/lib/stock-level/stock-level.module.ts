/**
 * NestJS module of the ledger engine.
 *
 * The engine is the write path other aggregates call, never a resource that writes a quantity of its
 * own, and the level it maintains is a resource its callers read and reconcile through. The engine is
 * exported so every aggregate that changes stock injects it instead of writing a level row directly.
 */
import { Module } from '@nestjs/common';
import { RolePermissionModule } from '@gauzy/core';
import { StockLevelController } from './stock-level.controller';
import { StockLevelService } from './stock-level.service';

@Module({
	controllers: [StockLevelController],
	imports: [RolePermissionModule],
	providers: [StockLevelService],
	exports: [StockLevelService]
})
export class StockLevelModule {}
