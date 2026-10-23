/**
 * Update StockAdjustment request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockAdjustmentDTO } from './create-stock-adjustment.dto';

/**
 * Update StockAdjustment request DTO validation.
 */
export class UpdateStockAdjustmentDTO extends PartialType(CreateStockAdjustmentDTO) {}
