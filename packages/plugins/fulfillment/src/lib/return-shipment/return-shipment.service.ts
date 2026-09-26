import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { IReturnLeg, IReturnLegRequest } from '../fulfillment.types';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { ShippingOption } from '../shipping-option/shipping-option.entity';
import { ShippingOptionService } from '../shipping-option/shipping-option.service';

/**
 * The metadata member the return a leg serves is recorded under.
 *
 * The parcel that travels back and the return that authorised it are one journey, and the two are
 * owned by different domains: the return is a row of the domain that decided on it, and the leg is a
 * fulfilment. Neither table names the other, and a leg that could not be traced back to the return
 * it was raised for would be a parcel nobody can explain, so the reference is kept in the shipment's
 * open-ended payload — the one place this table keeps identifiers its columns do not name.
 */
const RETURN_KEY = 'returnId';

/**
 * The outbound leg a return or an exchange travels on.
 *
 * Shipping a parcel needs a carrier, a label and a route, and this domain owns the fact that a parcel
 * moves: what it raises here is a fulfilment whose direction is `RETURN`, so the leg is a shipment
 * like any other — it has a status, a lifecycle, a tracking number and a location — and the domain
 * that owns shipments is the one that writes it.
 *
 * Three things about the answer are deliberate:
 *
 * 1. **The leg carries the shipment, not the goods.** What comes back is recorded as it arrives,
 *    against the lines of the flow that asked for it, so the leg holds no lines of its own. It is the
 *    journey that is created here, and its identity is what the caller keeps.
 * 2. **The configured option supplies what the journey knows.** A chosen shipping option names the
 *    registered strategy that will carry the parcel and the service level the tenant sells it as, and
 *    both are recorded on the leg, because the option is the only place a tenant configures them. The
 *    option's display label is not a service level and is not copied into one, and the carrier's own
 *    name is not configured on the option at all, so it stays absent rather than being guessed at.
 * 3. **The label is reported when there is one.** No carrier integration is installed in this
 *    platform, so a label is a document something else obtained; the leg reports the label it holds
 *    and reports nothing rather than a fabricated reference when it holds none.
 *
 * The class owns no table and writes nothing of its own: it composes the shipment service, which
 * raises the leg and holds its lifecycle, and the option service, which owns what an option is.
 */
@Injectable()
export class ReturnShipmentService {
	constructor(
		private readonly fulfillmentService: FulfillmentService,
		private readonly shippingOptionService: ShippingOptionService
	) {}

	/**
	 * Raises the return leg for a return or an exchange.
	 *
	 * @param request The return, the order it came from, and whatever else is already known about the
	 * journey.
	 * @returns The raised leg: the shipment that carries it, and whatever the carrier has already
	 * issued.
	 * @throws BadRequestException when no return or no order was named.
	 * @throws NotFoundException when the shipping option is not the caller's, which is also the answer
	 * for one that does not exist.
	 */
	public async createReturnShipment(request: IReturnLegRequest): Promise<IReturnLeg> {
		if (!request?.returnId) {
			throw new BadRequestException(
				'RETURN_LEG_RETURN_REQUIRED: a return leg is raised for the return it brings the goods back on.'
			);
		}

		if (!request.orderId) {
			throw new BadRequestException(
				'RETURN_LEG_ORDER_REQUIRED: a return leg is a shipment against the order the goods came from.'
			);
		}

		const option = request.shippingOptionId ? await this.optionOrFail(request.shippingOptionId) : undefined;

		const leg = await this.fulfillmentService.createReturnLeg({
			orderId: request.orderId,
			...(request.warehouseId ? { warehouseId: request.warehouseId } : {}),
			...(request.trackingNumber ? { trackingNumber: request.trackingNumber } : {}),
			...(option?.providerKey ? { providerId: option.providerKey } : {}),
			...(option?.code ? { service: option.code } : {}),
			metadata: { [RETURN_KEY]: request.returnId }
		});

		return {
			fulfillmentId: leg.id,
			...(leg.trackingNumber ? { trackingNumber: leg.trackingNumber } : {}),
			...(leg.labelUrl ? { labelUrl: leg.labelUrl } : {})
		};
	}

	/**
	 * Reads the chosen shipping option inside the caller's tenant and organization.
	 *
	 * The read is the fail-soft half of the kernel's pair, because an option that is not the caller's
	 * is an ordinary answer here and is turned into a refusal that names what was actually wrong: a
	 * leg raised without the option's carrier and service would be a parcel that quietly does not
	 * travel the way the tenant configured its returns to travel.
	 *
	 * @param shippingOptionId The option.
	 * @returns The option.
	 * @throws NotFoundException when it is not the caller's.
	 */
	private async optionOrFail(shippingOptionId: ID): Promise<ShippingOption> {
		const outcome = await this.shippingOptionService.findOneOrFailByWhereOptions({
			id: shippingOptionId,
			...this.scope()
		} as FindOptionsWhere<ShippingOption>);

		if (!outcome.success) {
			throw new NotFoundException({
				message: `SHIPPING_OPTION_NOT_FOUND: no shipping option in the caller's organization has id ${shippingOptionId}.`,
				code: 'SHIPPING_OPTION_NOT_FOUND',
				details: { shippingOptionId }
			});
		}

		return outcome.record as ShippingOption;
	}

	/**
	 * @returns The tenant and organization every read here is scoped to.
	 */
	private scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}
}
