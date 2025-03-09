import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '@gauzy/core';
import { ITimerWebhookEvent, TimerEventType, TimerEventDataType } from './interfaces/timer-webhook.interface';
import { MakeComService } from './make-com.service';

@Injectable()
export class WebhookService {
	private readonly logger = new Logger(WebhookService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly httpService: HttpService,
		private readonly makeComService: MakeComService
	) {}

	/**
	 * Retrieves the Make.com webhook configuration.
	 *
	 * This method combines the logic of fetching the tenant-specific integration settings and checking
	 * whether the integration is enabled. It first attempts to obtain the tenant-specific settings; if they are
	 * enabled and contain a valid webhook URL, it returns that URL with the enabled flag set to true.
	 * Otherwise, it falls back to the global configuration defined in the environment.
	 *
	 * @returns A promise that resolves to an object containing:
	 *          - enabled: A boolean indicating if the Make.com integration is enabled.
	 *          - webhookUrl: A string with the webhook URL, or null if not configured.
	 */
	private async getWebhookConfig(): Promise<{ enabled: boolean; webhookUrl: string | null }> {
		try {
			// Retrieve integration settings for the current tenant.
			const settings = await this.makeComService.getIntegrationSettings();

			if (settings?.isEnabled && settings.webhookUrl) {
				return { enabled: true, webhookUrl: settings.webhookUrl };
			}
		} catch (error) {
			this.logger.error('Error retrieving integration settings for webhook URL', error);
		}

		// Fallback to the global webhook URL from the environment variable.
		const globalWebhookUrl = this.configService.get<string>('MAKE_WEBHOOK_URL') || null;
		return { enabled: !!globalWebhookUrl, webhookUrl: globalWebhookUrl };
	}

	/**
	 * Emits a timer event to the Make.com webhook.
	 *
	 * This function uses the getWebhookConfig() method to determine if the Make.com integration is enabled
	 * and to retrieve the webhook URL. If the integration is enabled and a webhook URL is available,
	 * it constructs the payload and sends the event via an HTTP POST request.
	 *
	 * @param eventType - The type of the timer event (e.g., start, stop).
	 * @param data - The data payload associated with the timer event, extending TimerEventDataType.
	 * @returns A promise that resolves to void when the event is emitted or if the emission is skipped due to configuration issues.
	 */
	async emitTimerEvent<T extends TimerEventDataType>(eventType: TimerEventType, data: T): Promise<void> {
		try {
			// Retrieve webhook configuration which includes both the enabled flag and the webhook URL.
			const { enabled, webhookUrl } = await this.getWebhookConfig();
			if (!enabled) {
				this.logger.debug('Make.com integration is not enabled for this tenant, skipping event emission');
				return;
			}
			if (!webhookUrl) {
				this.logger.warn('Make.com webhook URL not configured for this tenant');
				return;
			}

			// Get the current tenant ID.
			const tenantId = RequestContext.currentTenantId();

			// Construct the payload for the webhook event.
			const payload: ITimerWebhookEvent<T> = {
				event: `timer.${eventType}`,
				data,
				timestamp: new Date().toISOString(),
				tenantId
			};

			// Send the payload to the Make.com webhook.
			await firstValueFrom(
				this.httpService.post(webhookUrl, payload, {
					timeout: 10000,
					headers: {
						'Content-Type': 'application/json'
					}
				})
			);
			this.logger.log(`Timer ${eventType} event sent to Make.com webhook for tenant ${tenantId}`);
		} catch (error) {
			this.logger.error(`Failed to emit timer ${eventType} event to Make.com:`, error);
		}
	}
}
