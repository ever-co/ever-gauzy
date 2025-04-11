import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { TimerStartedEvent } from '@gauzy/core';
import { ZapierWebhookService } from '../zapier-webhook.service';

@Injectable()
@EventsHandler(TimerStartedEvent)
export class ZapierTimerStartedHandler implements IEventHandler<TimerStartedEvent> {
    private readonly logger = new Logger(ZapierTimerStartedHandler.name);
    constructor(private readonly zapierWebhookService: ZapierWebhookService) { }
    /**
     * Handles the TimerStartedEvent by notifying Zapier webhooks
     *
     * @param event - The TimerStartedEvent that contains the time log details
     * @returns A Promise that resolves once the webhooks are notified
     */
    async handle(event: TimerStartedEvent): Promise<void> {
        const timeLog = event.timeLog;
        await this.zapierWebhookService.notifyTimerStatusChanged({
            event: 'timer.status.changed',
            action: 'start',
            data: timeLog,
            tenantId: timeLog.tenantId!,
            organizationId: timeLog.organizationId!
        });
    }
}
