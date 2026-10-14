/**
 * Update StockCount request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockCountDTO } from './create-stock-count.dto';

/**
 * Update StockCount request DTO validation.
 */
export class UpdateStockCountDTO extends PartialType(CreateStockCountDTO) {}
