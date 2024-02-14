import { Module } from '@nestjs/common';
import { EventBus } from './event-bus';

@Module({
    imports: [],
    providers: [EventBus],
    exports: [EventBus],
})
export class EventBusModule { }
