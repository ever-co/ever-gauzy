import { Global, Module } from '@nestjs/common';
import { MoneyService } from './money.service';

/**
 * Exposes the platform money layer.
 *
 * The module is global because every money-bearing capability rounds and formats through it — a cart,
 * an order, an invoice, an expense, a payroll run — and threading an import through each of them
 * would make it easier to call `toFixed` locally than to use the one strategy the installation
 * configured.
 */
@Global()
@Module({
	providers: [MoneyService],
	exports: [MoneyService]
})
export class MoneyModule {}
