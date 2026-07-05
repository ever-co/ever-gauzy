import {
	Controller,
	Post,
	Body,
	Headers,
	Param,
	Delete,
	ForbiddenException,
	Logger,
	UnauthorizedException,
	BadRequestException,
	InternalServerErrorException
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { IZapierCreateWebhookInput } from './zapier.types';
import { ZapierWebhookService } from './zapier-webhook.service';
import { ZapierService } from './zapier.service';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';

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
	 * @param id - The unique identifier of the webhook subscription to delete.
	 * @param authorization - The Bearer token for authenticating the request.
	 */
	@ApiOperation({ summary: 'Delete an existing Zapier webhook subscription' })
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
	async deleteWebhook(@Param('id') id: string, @Headers('Authorization') authorization: string): Promise<void> {
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

			if (!integration.tenantId) {
				throw new BadRequestException('Integration tenant ID is required.');
			}

			await this.zapierWebhookService.deleteSubscription(id, integration.tenantId);
		} catch (error) {
			this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
			throw new InternalServerErrorException('Failed to delete webhook subscription.');
		}
	}
}
