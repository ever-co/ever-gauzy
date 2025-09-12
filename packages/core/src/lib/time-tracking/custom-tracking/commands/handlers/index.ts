import type { Provider } from '@nestjs/common';
import { ProcessTrackingDataHandler } from './process-tracking-data.handler';
import { CustomTrackingBulkCreateHandler } from './custom-tracking-bulk-create.handler';

export const CommandHandlers: Provider[] = [ProcessTrackingDataHandler, CustomTrackingBulkCreateHandler];
