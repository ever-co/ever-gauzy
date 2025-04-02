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
import { ZapierWebhookService } from './zapier-webhook.service';
import { ZapierService } from './zapier.service';
import { IZapierCreateWebhookInput } from '@gauzy/contracts';
import { ZapierWebhookSubscriptionRepository } from './repository/zapier-repository.entity';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('/integration/zapier')
export class ZapierWebhookController {
	private readonly logger = new Logger(ZapierWebhookController.name);

	constructor(
		private readonly zapierWebhookService: ZapierWebhookService,
		private readonly zapierService: ZapierService
	) {}

	@ApiOperation({ summary: 'Create a new Zapier webhook subscription' })
	@ApiResponse({
		status: 200,
		description: 'Webhook subscription created successfully'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Post('/webhooks')
	async createWebhook(
		@Body() body: IZapierCreateWebhookInput,
		@Headers('Authorization') authorization: string
	): Promise<ZapierWebhookSubscriptionRepository> {
		if (!authorization) {
			throw new UnauthorizedException('Authorization header is required');
		}
		if(!authorization.startsWith('Bearer')) {
			throw new UnauthorizedException('Authorization header must start with Bearer');
		}
		const token = authorization.split(' ')[1];

		try {
			const integration = await this.zapierService.findIntegrationByToken(token);

			if (!integration) {
				throw new ForbiddenException('Invalid token');
			}

			if (!body.target_url || !body.event) {
				throw new BadRequestException('target_url and event are required');
			}

			if (!integration.tenantId) {
				throw new BadRequestException('Integration tenant ID is required');
			}

			if (!integration.organizationId) {
				throw new BadRequestException('Integration organization ID is required');
			}

			const subscription = await this.zapierWebhookService.createSubscription({
				targetUrl: body.target_url,
				event: body.event,
				integrationId: integration.id,
				tenantId: integration.tenantId,
				organizationId: integration.organizationId
			});
			return subscription;
		} catch (error) {
			if (error instanceof ForbiddenException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error('Failed to create webhook subscription', error);
			throw new InternalServerErrorException('Failed to create webhook subscription');
		}
	}

	@ApiOperation({ summary: 'Delete an existing Zapier webhook subscription' })
	@ApiResponse({
		status: 200,
		description: 'Webhook subscription deleted successfully'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Delete('/webhooks/:id')
	async deleteWebhook(
		@Param('id') id: string,
		@Headers('Authorization') authorization: string
	): Promise<void> {
		if (!authorization) {
			throw new UnauthorizedException('Authorization header is required');
		}
		const token = authorization.replace('Bearer ', '');

		try {
			const integration = await this.zapierService.findIntegrationByToken(token);

			if (!integration) {
				throw new ForbiddenException('Invalid token');
			}

			if (!integration.tenantId) {
				throw new BadRequestException('Integration tenant ID is required');
			}

			await this.zapierWebhookService.deleteSubscription(id, integration.tenantId);
		} catch (error) {
			if (error instanceof ForbiddenException || error instanceof UnauthorizedException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
			throw new InternalServerErrorException('Failed to delete webhook subscription');
		}
	}
}
