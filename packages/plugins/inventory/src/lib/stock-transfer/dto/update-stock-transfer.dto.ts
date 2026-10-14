/**
 * Update StockTransfer request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockTransferDTO } from './create-stock-transfer.dto';

/**
 * Update StockTransfer request DTO validation.
 */
export class UpdateStockTransferDTO extends PartialType(CreateStockTransferDTO) {}
