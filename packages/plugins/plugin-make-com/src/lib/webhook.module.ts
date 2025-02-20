import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WebhookService } from './webhook.service';

@Module({
    imports: [
        HttpModule,
        ConfigModule
    ],
    providers: [WebhookService],
    exports: [WebhookService]
})
export class WebhookModule {}
