import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, PermissionsEnum, WebhookDeliveryStatus } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IRedactedWebhookDelivery, WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDeliveryQueryDTO } from './dto';

/**
 * The outbound delivery log over REST.
 *
 * **A delivery is one row per event per subscription**, written before the first attempt and updated
 * by every one after it, which is what makes the log the answer to "did the partner receive it?" and
 * the input to every redelivery. It is a read-mostly resource: two reads and one operation, and the
 * operation only puts a row back in the queue — the worker is what calls an endpoint, so a route here
 * never blocks on a partner's server.
 *
 * **The stored body is not a member of the answer.** The projection this resource serves withholds
 * the payload: it is the verbatim event envelope, carrying whatever the producing domain put in it,
 * while the delivery log is read under `WEBHOOKS_VIEW` — the permission that configures integrations
 * rather than the one the event's own domain demands. Nothing an operator does here needs to read one:
 * a redelivery resends the stored bytes, and triage reads what the endpoint answered, which is served.
 *
 * **`WEBHOOK_DELIVERIES_RETRY` is the permission, not `WEBHOOKS_EDIT`.** Requeueing a delivery is not
 * a configuration change: it points the platform at an endpoint that is already configured, and the
 * catalogue gives it a permission of its own so that watching a log and re-firing it are separable.
 */
@ApiTags('WebhookDelivery')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
@Controller('/webhooks/deliveries')
export class WebhookDeliveryController {
	constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {}

	/**
	 * Lists the deliveries of the caller's organization.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of deliveries, none of which carries the stored body.
	 */
	@ApiOperation({ summary: 'List webhook deliveries' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Deliveries retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: WebhookDeliveryQueryDTO): Promise<IPagination<IRedactedWebhookDelivery>> {
		const rows = await this.webhookDeliveryService.listDeliveries(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		return paginateRows(rows, take, skip);
	}

	/**
	 * Reads one delivery, for triage.
	 *
	 * What the answer carries is what an operator triages with: the status the row reached, the HTTP
	 * status the endpoint answered, the first kilobytes of its response, how long the attempt took, and
	 * the transport or TLS error when there was no answer at all.
	 *
	 * @param id The delivery to read.
	 * @returns The delivery, with the stored body withheld.
	 */
	@ApiOperation({ summary: 'Find a webhook delivery by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Delivery retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_DELIVERY_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<IRedactedWebhookDelivery> {
		return this.webhookDeliveryService.getRedactedDelivery(id);
	}

	/**
	 * Requeues one delivery for another attempt.
	 *
	 * The row is reset rather than duplicated, and the payload it already holds is what goes out
	 * again, so a redelivery reproduces the original request rather than a newer projection of the
	 * same event. A delivery is requeued whatever status it reached, the terminal one included: a dead
	 * delivery is precisely the row an operator redelivers once the receiver has been fixed. When the
	 * attempt happens is the retry worker's to decide, so this route answers the requeued row rather
	 * than an attempt's outcome.
	 *
	 * @param id The delivery to requeue.
	 * @returns The requeued delivery, `PENDING` and due immediately.
	 */
	@ApiOperation({ summary: 'Redeliver a webhook delivery' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Delivery requeued' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_DELIVERY_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOK_DELIVERIES_RETRY)
	@HttpCode(HttpStatus.OK)
	@Post(':id/redeliver')
	async redeliver(@Param('id', UUIDValidationPipe) id: string): Promise<IRedactedWebhookDelivery> {
		return this.webhookDeliveryService.redact(await this.webhookDeliveryService.requeue(id));
	}

	/**
	 * The narrowing members of the list query, from whichever spelling stated them.
	 *
	 * The bracketed spelling wins when both are stated, because that is the spelling the endpoint
	 * table fixes. A member that was not stated is left out rather than written as `undefined`,
	 * because a repository handed an explicit `undefined` asks the database for a row whose column
	 * *is* null — which is a different question from "do not narrow on this column".
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: WebhookDeliveryQueryDTO): {
		subscriptionId?: string;
		eventId?: string;
		eventName?: string;
		status?: WebhookDeliveryStatus;
	} {
		const stated: {
			subscriptionId?: string;
			eventId?: string;
			eventName?: string;
			status?: WebhookDeliveryStatus;
		} = {};

		for (const member of ['subscriptionId', 'eventId', 'eventName', 'status'] as const) {
			const value = query?.filter?.[member] ?? query?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		return stated;
	}
}
