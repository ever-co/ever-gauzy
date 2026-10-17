/**
 * Update ChannelWarehouse request DTO validation.
 *
 * Every column is optional on update; a caller sends the fields it changes and nothing else.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateChannelWarehouseDTO } from './create-channel-warehouse.dto';

/**
 * Update ChannelWarehouse request DTO validation.
 */
export class UpdateChannelWarehouseDTO extends PartialType(CreateChannelWarehouseDTO) {}
