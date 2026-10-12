import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IRedactedWebhookSubscription, IWebhookSubscriptionCredential, WebhookSubscriptionService } from './webhook-subscription.service';
import {
	CreateWebhookSubscriptionDTO,
	DisableWebhookSubscriptionDTO,
	UpdateWebhookSubscriptionDTO,
	WebhookSubscriptionQueryDTO
} from './dto';

/**
 * The outbound delivery endpoints over REST.
 *
 * **A subscription is how a consumer outside the platform receives events**, and this is where an
 * operator configures one: the endpoint, the events it wants, the channel it listens to, and the
 * signing secret it verifies with. The routes below are that resource's whole surface, and the
 * design's permission catalogue gives the quartet `WEBHOOKS_VIEW`, `WEBHOOKS_CREATE`, `WEBHOOKS_EDIT`
 * and `WEBHOOKS_DELETE` to exactly these operations — so a role can be trusted to watch a delivery
 * log without being able to point the platform at an endpoint of its choosing.
 *
 * **Every route speaks through `WebhookSubscriptionService`**, which owns the domain's rules: the
 * endpoint is HTTPS unless the installation explicitly allows otherwise, one subscription per
 * `(organization, url)` because a duplicate would double-deliver every event, the event list is never
 * empty, and the signing secret is generated rather than supplied. This class adds permissions,
 * validation and the list envelope — never a second copy of a rule.
 *
 * **The secret is answered twice and is a member of no type.** `POST /` and
 * `POST /:id/rotate-secret` are the two moments a plaintext secret exists, and both answer the
 * subscription beside it; every other route answers the projection the service's `redact` produces,
 * in which the secret is replaced by a fingerprint. There is deliberately no route that reads a
 * secret back, and no body member through which one could be set: a caller that could set its own
 * secret could sign a payload the platform never sent.
 *
 * **No tenant and no organization is stated by a caller.** The service stamps both from the
 * credential, which is what keeps a subscription from being written into a tenant the caller is not
 * acting in, and is why neither is a member of either body.
 *
 * **The paginated and count spellings of the CRUD base are deliberately absent.** This resource is
 * not a `CrudController`: the base's create would store a row without a generated secret, which is
 * the one thing this resource must never do, and the base's removal pair would offer a withdrawal
 * this domain has no notion of. The routes below are exactly the capabilities the design names, and
 * each of them has a field on the GraphQL surface beside it.
 */
@ApiTags('WebhookSubscription')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
@Controller('/webhooks/subscriptions')
export class WebhookSubscriptionController {
	constructor(private readonly webhookSubscriptionService: WebhookSubscriptionService) {}

	/**
	 * Lists the subscriptions of the caller's organization.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of subscriptions, each with its secret replaced by a fingerprint.
	 */
	@ApiOperation({ summary: 'List webhook subscriptions' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Subscriptions retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: WebhookSubscriptionQueryDTO): Promise<IPagination<IRedactedWebhookSubscription>> {
		const rows = await this.webhookSubscriptionService.listSubscriptions(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);
		const page = paginateRows(rows, take, skip);

		return { items: page.items, total: page.total };
	}

	/**
	 * Reads one subscription.
	 *
	 * @param id The subscription to read.
	 * @returns The subscription, with its secret replaced by a fingerprint.
	 */
	@ApiOperation({ summary: 'Find a webhook subscription by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Subscription retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<IRedactedWebhookSubscription> {
		return this.webhookSubscriptionService.getRedactedSubscription(id);
	}

	/**
	 * Subscribes an endpoint.
	 *
	 * @param entity The endpoint as the caller states it.
	 * @returns The stored subscription and the secret generated for it, which is the only time the
	 * secret is readable through this route.
	 */
	@ApiOperation({ summary: 'Create a webhook subscription' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Subscription created, with its signing secret' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_FAILED, WEBHOOK_URL_NOT_ALLOWED' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'UNIQUE_CONSTRAINT_VIOLATION' })
	@Permissions(PermissionsEnum.WEBHOOKS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateWebhookSubscriptionDTO): Promise<IWebhookSubscriptionCredential> {
		return this.webhookSubscriptionService.createSubscription(entity);
	}

	/**
	 * Changes the mutable facts of a subscription.
	 *
	 * The endpoint, the event selection, the channel and the descriptive members are what a caller may
	 * change. The switch, the counters and the secret are not: each has an operation of its own,
	 * because each is a different decision from editing an endpoint.
	 *
	 * @param id The subscription to change.
	 * @param entity The facts to change.
	 * @returns The stored subscription.
	 */
	@ApiOperation({ summary: 'Update a webhook subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Subscription updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_FAILED, WEBHOOK_URL_NOT_ALLOWED' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateWebhookSubscriptionDTO
	): Promise<IRedactedWebhookSubscription> {
		return this.webhookSubscriptionService.updateSubscription(id, entity);
	}

	/**
	 * Removes a subscription and, by the table's own cascade, its delivery log.
	 *
	 * @param id The subscription to remove.
	 * @returns The store's delete result.
	 */
	@ApiOperation({ summary: 'Delete a webhook subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Subscription deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<DeleteResult> {
		return this.webhookSubscriptionService.delete(id);
	}

	/**
	 * Rotates the signing secret.
	 *
	 * The previous secret stays valid for the service's own grace window, so the endpoint can be
	 * reconfigured without losing deliveries; the instant it stops being accepted is answered beside
	 * the new secret, because an operator handing a partner a new one has to be able to say how long
	 * the old one still works.
	 *
	 * @param id The subscription whose secret is rotated.
	 * @returns The subscription, the new secret and the instant the previous one expires.
	 */
	@ApiOperation({ summary: 'Rotate a webhook subscription signing secret' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Secret rotated; the new one is answered once' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/rotate-secret')
	async rotateSecret(@Param('id', UUIDValidationPipe) id: string): Promise<IWebhookSubscriptionCredential> {
		return this.webhookSubscriptionService.rotateSecret(id);
	}

	/**
	 * Switches an endpoint back on.
	 *
	 * The failure counter is reset with the switch, which is why this is an operation rather than a
	 * field of the update body: re-enabling an endpoint while keeping the count that disabled it would
	 * disable it again on its first hiccup.
	 *
	 * @param id The subscription to enable.
	 * @returns The stored subscription.
	 */
	@ApiOperation({ summary: 'Enable a webhook subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Subscription enabled' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/enable')
	async enable(@Param('id', UUIDValidationPipe) id: string): Promise<IRedactedWebhookSubscription> {
		return this.webhookSubscriptionService.enable(id);
	}

	/**
	 * Switches an endpoint off.
	 *
	 * Disabling is immediate and loses nothing already queued: the deliveries the platform has already
	 * written walk their retry schedule to its end and dead-letter on their own, and re-enabling
	 * resumes without an automatic replay — a gap is redelivered deliberately rather than by accident.
	 * The fact is announced by the service, so a subscriber watching the integration learns of the
	 * switch whichever protocol threw it.
	 *
	 * @param id The subscription to disable.
	 * @param entity Why it is being switched off.
	 * @returns The stored subscription.
	 */
	@ApiOperation({ summary: 'Disable a webhook subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Subscription disabled' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND' })
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/disable')
	@UseValidationPipe({ transform: true, whitelist: true })
	async disable(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity?: DisableWebhookSubscriptionDTO
	): Promise<IRedactedWebhookSubscription> {
		return this.webhookSubscriptionService.disable(id, entity?.reason);
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
	private narrowing(query?: WebhookSubscriptionQueryDTO): { isActive?: boolean; channelId?: string } {
		const stated: { isActive?: boolean; channelId?: string } = {};

		for (const member of ['isActive', 'channelId'] as const) {
			const value = query?.filter?.[member] ?? query?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		return stated;
	}
}
