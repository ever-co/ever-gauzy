/**
 * Update StockTransferLine request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockTransferLineDTO } from './create-stock-transfer-line.dto';

/**
 * Update StockTransferLine request DTO validation.
 */
export class UpdateStockTransferLineDTO extends PartialType(CreateStockTransferLineDTO) {}
