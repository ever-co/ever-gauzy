import { Controller, Post, Body, Headers, Param, Delete, ForbiddenException, Logger, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ZapierWebhookService } from './zapier-webhook.service';
import { ZapierService } from './zapier.service';
import { IZapierCreateWebhookInput } from '@gauzy/contracts';
import { ZapierWebhookSubscription } from './repository/zapier-repository.entity';

@Controller('/integration/zapier')
export class ZapierWebhookController {
    constructor(
        private readonly zapierWebhookService: ZapierWebhookService,
        private readonly zapierService: ZapierService,
        private readonly logger = new Logger(ZapierWebhookController.name)
    ) {}

    @Post('/webhooks')
    async createWebhook(@Body() body: IZapierCreateWebhookInput, @Headers('Authorization') authorization: string): Promise<ZapierWebhookSubscription> {
        if (!authorization) {
            throw new UnauthorizedException('Authorization header is required');
        }
        const token = authorization.replace('Bearer ', '');
            try {
                const integration = await this.zapierService.findIntegrationByToken(token);

                if (!integration) {
                    throw new ForbiddenException('Invalid token');
                }

                if (!body.target_url || !body.event) {
                    throw new BadRequestException('target_url and event are required');
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

    @Delete('/webhooks/:id')
    async deleteWebhook(@Param('id') id: string): Promise<void> {
        try {
            await this.zapierWebhookService.deleteSubscription(id);
        } catch (error) {
            this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
            throw new InternalServerErrorException('Failed to delete webhook subscription');
        }
    }
}
