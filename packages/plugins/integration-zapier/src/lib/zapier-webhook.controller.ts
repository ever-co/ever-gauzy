import {
	Controller,
	Get,
	Post,
	Body,
	Headers,
	Param,
	Query,
	Delete,
	ForbiddenException,
	Logger,
	NotFoundException,
	UnauthorizedException,
	BadRequestException,
	InternalServerErrorException,
	HttpException,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ID, IIntegrationTenant, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions } from '@gauzy/core';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { IZapierCreateWebhookInput } from './zapier.types';
import { ZapierWebhookService } from './zapier-webhook.service';
import { ZapierService } from './zapier.service';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';

/**
 * The REST hooks Zapier subscribes and unsubscribes with. A subscription streams the organization's events — every
 * employee's timer, with its time log — to the URL it names, so subscribing is configuring the integration: it needs
 * the integration grants the rest of the Zapier routes state. Before, any signed-in member of the tenant (an employee
 * with no integration permission) could point the organization's events at a URL of their own, or remove the
 * organization's real subscriptions.
 *
 * `PermissionGuard` alone, not `TenantPermissionGuard`: Zapier sends no `Tenant-Id` header and no tenant in the body,
 * and the tenant is the one of the integration the bearer token resolves to, never one the request names.
 *
 * The web app lists (`GET /webhooks`) and removes a subscription naming the integration (`integrationId`) instead: its
 * `Authorization` header is the user's session, and the integration is read in the user's own tenant, for a member of
 * its organization.
 */
@UseGuards(PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/zapier')
export class ZapierWebhookController {
	private readonly logger = new Logger(ZapierWebhookController.name);

	constructor(
		private readonly zapierWebhookService: ZapierWebhookService,
		private readonly zapierService: ZapierService
	) {}

	/**
	 * Handles the incoming request with the provided request body and authorization token.
	 *
	 * @param body - The request payload containing the data required for processing.
	 * @param authorization - The authorization token used for authenticating the request.
	 * @returns A promise or response object indicating the outcome of the request (e.g., success status, data, or error).
	 */
	@ApiOperation({ summary: 'Create a new Zapier webhook subscription' })
	@ApiResponse({
		status: 201,
		description: 'Webhook subscription created successfully',
		type: ZapierWebhookSubscription
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Missing required fields'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Invalid token'
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error'
	})
	@Post('/webhooks')
	async createWebhook(
		@Body() body: IZapierCreateWebhookInput,
		@Headers('Authorization') authorization: string
	): Promise<ZapierWebhookSubscription> {
		if (!authorization) {
			throw new UnauthorizedException('Authorization header is required');
		}

		if (!authorization.startsWith('Bearer ')) {
			throw new UnauthorizedException('Authorization header must start with Bearer');
		}

		const token = authorization.split(' ')[1];

		try {
			// Resolve integration from opaque token or JWT (multi-app OAuth)
			const integration = await this.zapierService.resolveIntegrationFromBearerToken(token);

			if (!integration) {
				throw new ForbiddenException('Invalid token');
			}

			const { target_url, event } = body;

			if (!target_url || !event) {
				throw new BadRequestException('target_url and event are required');
			}

			// Validate webhook URL
			this.validateWebhookUrl(target_url);

			// Validate event name
			this.validateEventName(event);

			const { tenantId, organizationId, id: integrationId } = integration;

			if (!tenantId) {
				throw new BadRequestException('Integration tenant ID is required');
			}

			if (!organizationId) {
				throw new BadRequestException('Integration organization ID is required');
			}

			const subscription = await this.zapierWebhookService.createSubscription({
				targetUrl: target_url,
				event,
				integrationId,
				tenantId,
				organizationId
			});

			return subscription;
		} catch (error) {
			this.logger.error('Failed to create webhook subscription', error);
			if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof ForbiddenException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to create webhook subscription');
		}
	}

	/**
	 * Lists the webhook subscriptions of a Zapier integration.
	 *
	 * The web app names the integration (`integrationId`): its own `Authorization` header always carries the signed-in
	 * user's session, never a Zapier token, so the integration is read in the caller's tenant for a member of its
	 * organization. Without `integrationId` the integration is the one the bearer token resolves to, as on the
	 * subscribe and unsubscribe routes, and the caller must be a member of its organization too.
	 *
	 * @param integrationId - The integration, as the web app names it.
	 * @param authorization - The Bearer token, when no integration is named.
	 */
	@ApiOperation({ summary: 'List the webhook subscriptions of a Zapier integration' })
	@ApiQuery({
		name: 'integrationId',
		required: false,
		type: String,
		description: 'The integration (the web app); without it, the integration the Bearer token resolves to'
	})
	@ApiResponse({
		status: 200,
		description: 'The webhook subscriptions, newest first',
		type: ZapierWebhookSubscription,
		isArray: true
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - No integration named and an invalid or missing authorization token'
	})
	@ApiResponse({
		status: 403,
		description: "Forbidden - Not a member of the integration's organization"
	})
	@ApiResponse({
		status: 404,
		description: 'No such Zapier integration in the tenant'
	})
	@Get('/webhooks')
	async getWebhooks(
		@Query('integrationId') integrationId: string | string[],
		@Headers('Authorization') authorization: string
	): Promise<ZapierWebhookSubscription[]> {
		try {
			const integrationIdNamed = this.integrationIdOf(integrationId);
			const named = await this.resolveIntegration(integrationIdNamed, authorization);
			if (!named.id) {
				throw new NotFoundException('Zapier integration not found');
			}
			// The bearer path resolves without a membership check: list only for a member of the organization
			const integration = integrationIdNamed
				? named
				: await this.zapierService.findIntegrationForCurrentUser(named.id);

			return await this.zapierWebhookService.findSubscriptions({
				integrationId: integration.id,
				tenantId: integration.tenantId,
				organizationId: integration.organizationId
			});
		} catch (error) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to list webhook subscriptions', error);
			throw new InternalServerErrorException('Failed to list webhook subscriptions.');
		}
	}

	/**
	 * The integration a request acts on: the one the web app names (`integrationId`), for a member of its organization;
	 * otherwise the one the Bearer token resolves to (opaque token or multi-app OAuth JWT), as Zapier calls.
	 */
	private async resolveIntegration(
		integrationId: string | undefined,
		authorization: string
	): Promise<IIntegrationTenant & { tenantId: ID }> {
		const integration = integrationId
			? await this.zapierService.findIntegrationForCurrentUser(integrationId)
			: await this.resolveBearerIntegration(authorization);

		if (!integration.tenantId) {
			throw new BadRequestException('Integration tenant ID is required.');
		}

		return integration as IIntegrationTenant & { tenantId: ID };
	}

	/**
	 * The `integrationId` a request names: one value, trimmed, or none when it is unset or empty. `ValidationPipe` is not
	 * run on these routes, and a repeated query parameter arrives as an array: refused (400) rather than failing on
	 * `trim` (500). A malformed ID is answered 404 by the lookup (`findIntegrationForCurrentUser`).
	 *
	 * @throws BadRequestException for a value that is not one string.
	 */
	private integrationIdOf(value: unknown): string | undefined {
		if (value === undefined || value === null) {
			return undefined;
		}
		if (typeof value !== 'string') {
			throw new BadRequestException('integrationId must be a single value');
		}
		return value.trim() || undefined;
	}

	/**
	 * The integration the Bearer token resolves to (opaque token or multi-app OAuth JWT).
	 */
	private async resolveBearerIntegration(authorization: string): Promise<IIntegrationTenant> {
		if (!authorization) {
			throw new UnauthorizedException('Authorization header is required');
		}

		if (!authorization.startsWith('Bearer ')) {
			throw new UnauthorizedException('Authorization header must start with Bearer');
		}

		const integration = await this.zapierService.resolveIntegrationFromBearerToken(authorization.split(' ')[1]);

		if (!integration) {
			throw new ForbiddenException('Invalid token');
		}

		return integration;
	}

	/**
	 * Validate webhook URL for security
	 */
	private validateWebhookUrl(url: string): void {
		// SSRF egress guard — applied UNCONDITIONALLY (previously the private-IP/loopback checks ran
		// only when NODE_ENV === 'production', leaving dev/staging unprotected). Rejects non-HTTPS
		// schemes, embedded credentials, and loopback/private/link-local hosts including the cloud
		// metadata IP 169.254.169.254 (GHSA-534m-c6mh-mp98 sibling).
		const reason = getUnsafeOutboundUrlReason(url);
		if (reason) {
			throw new BadRequestException(`Invalid webhook URL: ${reason}`);
		}
	}

	/**
	 * Validate event name
	 */
	private validateEventName(event: string): void {
		if (typeof event !== 'string') {
			throw new BadRequestException('Event must be a string');
		}

		if (event.length < 1 || event.length > 100) {
			throw new BadRequestException('Event name must be between 1 and 100 characters');
		}

		// Allow only alphanumeric characters, dots, underscores, and hyphens
		const EVENT_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;
		if (!EVENT_NAME_REGEX.test(event)) {
			throw new BadRequestException('Event name can only contain alphanumeric characters, dots, underscores, and hyphens');
		}
	}

	/**
	 * Deletes an existing Zapier webhook subscription.
	 *
	 * The integration is the one the web app names (`integrationId`, for a member of its organization), else the one the
	 * Bearer token resolves to, as Zapier unsubscribes; see `getWebhooks` for why the web app names it.
	 *
	 * @param id - The unique identifier of the webhook subscription to delete.
	 * @param authorization - The Bearer token for authenticating the request.
	 * @param integrationId - The integration, as the web app names it.
	 */
	@ApiOperation({ summary: 'Delete an existing Zapier webhook subscription' })
	@ApiQuery({
		name: 'integrationId',
		required: false,
		type: String,
		description: 'The integration (the web app); without it, the integration the Bearer token resolves to'
	})
	@ApiResponse({
		status: 200,
		description: 'Webhook subscription deleted successfully'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Missing or invalid parameters'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Invalid token'
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error'
	})
	@Delete('/webhooks/:id')
	async deleteWebhook(
		@Param('id') id: string,
		@Headers('Authorization') authorization: string,
		@Query('integrationId') integrationId?: string | string[]
	): Promise<void> {
		try {
			// The integration the web app names, else the one the opaque token or JWT (multi-app OAuth) resolves to
			const integration = await this.resolveIntegration(this.integrationIdOf(integrationId), authorization);

			await this.zapierWebhookService.deleteSubscription(id, integration.tenantId, integration.organizationId);
		} catch (error) {
			// Invalid token (403), missing tenant (400), unknown or foreign subscription (404 / 403): keep them,
			// as the subscribe route does, instead of answering 500
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
			throw new InternalServerErrorException('Failed to delete webhook subscription.');
		}
	}
}
