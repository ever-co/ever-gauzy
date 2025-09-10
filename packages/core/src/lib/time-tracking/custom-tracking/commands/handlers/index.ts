import type { Provider } from '@nestjs/common';
import { ProcessTrackingDataHandler } from './process-tracking-data.handler';

export const CommandHandlers: Provider[] = [ProcessTrackingDataHandler];
