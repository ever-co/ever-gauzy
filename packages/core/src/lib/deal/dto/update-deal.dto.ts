import { PartialType, PickType } from '@nestjs/mapped-types';
import { Deal } from '../../core/entities/internal';

/**
 * Update deal DTO.
 *
 * An edit may state any subset of the deal's own facts (moving a deal on the board sends only `stageId`),
 * so every member is optional; but a member that IS sent carries the same rules a create applies to it:
 * a non-empty title, a whole-number probability from 0 to 5, UUIDs for the stage and the client.
 *
 * Only the deal's own columns are declared. The tenant and organization scope members are not: they are
 * resolved by the guards and the service, and the route validates this DTO without stripping, so they
 * pass through untouched.
 */
export class UpdateDealDTO extends PartialType(PickType(Deal, ['title', 'probability', 'stageId', 'clientId'] as const)) {}
