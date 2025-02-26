import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../../../../core/src/lib/core/index';
import { MakeComIntegrationSetting } from './make-com-settings.entity';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        @InjectRepository(MakeComIntegrationSetting)
        private readonly settingsRepository: Repository<MakeComIntegrationSetting>
    ) {}

    /**
     * Get webhook URL from tenant settings or fallback to environment variable
     */
    private async getWebhookUrl(): Promise<string | null> {
        // Try to get tenant-specific webhook URL from database
        const tenantId = RequestContext.currentTenantId();

        if (tenantId) {
            const settings = await this.settingsRepository.findOne({
                where: { tenantId, isEnabled: true, organizationId: null }
            });

            if (settings?.webhookUrl) {
                return settings.webhookUrl;
            }
        }

        // Fallback to environment variable if no tenant-specific setting
        return this.configService.get<string>('MAKE_WEBHOOK_URL');
    }

    /**
     * Check if Make.com integration is enabled for the current tenant
     */
    private async isEnabled(): Promise<boolean> {
        const tenantId = RequestContext.currentTenantId();

        if (tenantId) {
            const settings = await this.settingsRepository.findOne({
                where: { tenantId, organizationId: null }
            });

            if (settings) {
                return settings.isEnabled;
            }
        }

        // If no tenant settings found, check if global webhook URL exists
        return !!this.configService.get<string>('MAKE_WEBHOOK_URL');
    }

    /**
     * Emit timer event to Make.com webhook
     */
    async emitTimerEvent(eventType: 'start' | 'stop' | 'status', data: any): Promise<void> {
        try {
            // Check if integration is enabled for the current tenant
            const isEnabled = await this.isEnabled();
            if (!isEnabled) {
                this.logger.debug('Make.com integration is not enabled for this tenant, skipping event emission');
                return;
            }

            // Get webhook URL for the current tenant
            const webhookUrl = await this.getWebhookUrl();
            if (!webhookUrl) {
                this.logger.warn('Make.com webhook URL not configured for this tenant');
                return;
            }

            // Prepare payload
            const payload = {
                event: `timer.${eventType}`,
                data,
                timestamp: new Date().toISOString(),
                tenantId: RequestContext.currentTenantId()
            };

            // Send to webhook
            await firstValueFrom(this.httpService.post(webhookUrl, payload));
            this.logger.log(`Timer ${eventType} event sent to Make.com webhook for tenant ${RequestContext.currentTenantId()}`);
        } catch (error) {
            this.logger.error(`Failed to emit timer ${eventType} event to Make.com:`, error);
        }
    }
}
