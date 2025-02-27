import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '@gauzy/core';
import {
  ITimerWebhookEvent,
  TimerEventType,
  TimerEventDataType
} from './interfaces/timer-webwook.interface';
import { MakeComSettingsService } from './make-com-settings.service';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly settingsService: MakeComSettingsService
    ) {}

    /**
     * Get webhook URL from tenant settings or fallback to environment variable
     */
    private async getWebhookUrl(): Promise<string | null> {
        // Try to get tenant-specific webhook URL from database
        const tenantId = RequestContext.currentTenantId();

        if (tenantId) {
            // Get settings using the settings service
            const settings = await this.settingsService.getSettingsForTenant(tenantId);

            // Check if settings exist and are enabled with a webhook URL
            if (settings.isEnabled && settings.webhookUrl) {
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
            try {
                // Get settings using the settings service
                const settings = await this.settingsService.getSettingsForTenant(tenantId);

                if (settings.isEnabled) {
                    return true;
                }
            } catch (error) {
                this.logger.error('Error checking if Make.com integration is enabled for tenant', error);
            }
        }

        // If no tenant settings found, check if global webhook URL exists
        const hasGlobalUrl = !!this.configService.get<string>('MAKE_WEBHOOK_URL');
        this.logger.debug(`No tenant settings found, using global configuration: ${hasGlobalUrl ? 'enabled' : 'disabled'}`);
        return hasGlobalUrl;
    }

    /**
     * Emit timer event to Make.com webhook
     */
    async emitTimerEvent<T extends TimerEventDataType>(
        eventType: TimerEventType,
        data: T
    ): Promise<void> {
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

            const tenantId = RequestContext.currentTenantId();

            // Prepare payload
            const payload: ITimerWebhookEvent<T> = {
                event: `timer.${eventType}`,
                data,
                timestamp: new Date().toISOString(),
                tenantId
            };

            // Send to webhook
            await firstValueFrom(this.httpService.post(webhookUrl, payload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }));
            this.logger.log(`Timer ${eventType} event sent to Make.com webhook for tenant ${tenantId}`);
        } catch (error) {
            this.logger.error(`Failed to emit timer ${eventType} event to Make.com:`, error);
        }
    }
}
