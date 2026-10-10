/**
 * Update StockMovement request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockMovementDTO } from './create-stock-movement.dto';

/**
 * Update StockMovement request DTO validation.
 */
export class UpdateStockMovementDTO extends PartialType(CreateStockMovementDTO) {}
