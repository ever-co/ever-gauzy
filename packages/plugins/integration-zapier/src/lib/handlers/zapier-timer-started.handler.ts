import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TimerStartedEvent } from '@gauzy/core';
import { ZapierWebhookService } from '../zapier-webhook.service';

@Injectable()
@EventsHandler(TimerStartedEvent)
export class ZapierTimerStartedHandler implements IEventHandler<TimerStartedEvent> {
    constructor(private readonly zapierWebhookService: ZapierWebhookService) { }

    /**
     * Handles the TimerStartedEvent by notifying Zapier webhooks
     *
     * @param event - The TimerStartedEvent that contains the time log details
     * @returns A Promise that resolves once the webhooks are notified
     */
    async handle(event: TimerStartedEvent): Promise<void> {
        const timeLog = event.timeLog;
        if (!timeLog.tenantId || !timeLog.organizationId) {
            console.warn('Cannot process timer started event: missing tenantId or organizationId')
        }
        await this.zapierWebhookService.notifyTimerStatusChanged({
            event: 'timer.status.changed',
            action: 'start',
            data: timeLog,
            tenantId: timeLog.tenantId,
            organizationId: timeLog.organizationId
        });
    }
}
