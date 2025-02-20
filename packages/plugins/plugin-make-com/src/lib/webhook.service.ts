import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TimeLog } from '../../../../core/src/lib/time-tracking/time-log/time-log.entity';

@Injectable()
export class WebhookService {
    private readonly webhookUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService
    ) {
        this.webhookUrl = this.configService.get<string>('MAKE_WEBHOOK_URL');
    }

    async emitTimerEvent(eventType: 'start' | 'stop' | 'status', timeLog: TimeLog): Promise<void> {
        if (!this.webhookUrl) {
            console.warn('Webhook URL not configured');
            return;
        }

        try {
            await this.httpService.post(this.webhookUrl, {
                event: `timer.${eventType}`,
                data: timeLog,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            console.error(`Failed to emit timer ${eventType} event:`, error);
        }
    }
}
