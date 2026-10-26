/**
 * Update StockAlert request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockAlertDTO } from './create-stock-alert.dto';

/**
 * Update StockAlert request DTO validation.
 */
export class UpdateStockAlertDTO extends PartialType(CreateStockAlertDTO) {}
