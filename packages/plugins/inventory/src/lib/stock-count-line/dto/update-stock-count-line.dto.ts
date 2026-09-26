/**
 * Update StockCountLine request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockCountLineDTO } from './create-stock-count-line.dto';

/**
 * Update StockCountLine request DTO validation.
 */
export class UpdateStockCountLineDTO extends PartialType(CreateStockCountLineDTO) {}
