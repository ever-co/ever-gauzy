/**
 * NestJS module of the ledger engine.
 *
 * The engine has no controller: it is the write path other aggregates call, never a resource of its
 * own. It is exported so every aggregate that changes stock injects it instead of writing a level
 * row directly.
 */
import { Module } from '@nestjs/common';
import { StockLevelService } from './stock-level.service';

@Module({
	providers: [StockLevelService],
	exports: [StockLevelService]
})
export class StockLevelModule {}
