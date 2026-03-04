import { Processor } from '@nestjs/bullmq';

export const QueueWorker: typeof Processor = Processor;
