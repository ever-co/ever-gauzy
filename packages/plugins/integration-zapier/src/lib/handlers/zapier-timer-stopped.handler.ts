import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStoppedEvent } from '@gauzy/core';
import { ZapierWebhookService } from '../zapier-webhook.service';

@Injectable()
@EventsHandler(TimerStoppedEvent)
export class ZapierTimerStoppedHandler implements IEventHandler<TimerStoppedEvent> {
    constructor(private readonly zapierWebhookService: ZapierWebhookService) {}

    /**
     * Handles the TimerStoppedEvent by notifying Zapier webhooks
     *
     * @param event - The TimerStoppedEvent that contains the time log details.
     * @returns A Promise that resolves once the webhooks are notified
     */
    async handle(event: TimerStoppedEvent): Promise<void> {
        const timeLog = event.timeLog;
        if (!timeLog.tenantId || !timeLog.organizationId) {
            console.warn('Cannot process timer stopped event: missing tenantId or organizationId')
            return;
        }
        await this.zapierWebhookService.notifyTimerStatusChanged({
            event: 'timer.status.changed',
            action: 'stop',
            data: timeLog,
            tenantId: timeLog.tenantId,
            organizationId: timeLog.organizationId
        });
    }
}
