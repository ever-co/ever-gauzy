/**
 * The draft of a manual correction as the `createStockAdjustment` field receives it.
 *
 * Every rule the route's body is held to — the location and the variant are UUIDs, the type is one the
 * ledger knows, the reason code and the free text fit their columns — is the route's own
 * `CreateStockAdjustmentDTO`'s, inherited rather than restated, so the two surfaces cannot drift apart.
 *
 * Only the scope members are left out. Over REST the body names the organization the draft belongs to,
 * and the validators check the caller belongs to it; over GraphQL the operation's organization is the
 * request's own, read by the request context from the headers the guards already checked. That is also
 * where the service takes the row's tenant and organization from on both surfaces — whatever a body says —
 * so the members decide nothing about the row. The schema's input type has no member to carry them, so a
 * field that demanded them would refuse every draft.
 */
import { OmitType } from '@nestjs/swagger';
import { CreateStockAdjustmentDTO } from './create-stock-adjustment.dto';

/**
 * Create StockAdjustment GraphQL input validation: the route's DTO without the request's scope members.
 */
export class CreateStockAdjustmentInputDTO extends OmitType(CreateStockAdjustmentDTO, [
	'organization',
	'organizationId',
	'sentTo',
	'tenant',
	'tenantId'
] as const) {}
