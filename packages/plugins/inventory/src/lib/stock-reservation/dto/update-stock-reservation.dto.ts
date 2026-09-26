/**
 * Update StockReservation request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateStockReservationDTO } from './create-stock-reservation.dto';

/**
 * Update StockReservation request DTO validation.
 */
export class UpdateStockReservationDTO extends PartialType(CreateStockReservationDTO) {}
