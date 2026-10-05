import { Module } from '@nestjs/common';
import { EverInstanceEvents } from './ever-instance.events';
import { EverInstanceService } from './ever-instance.service';
import { EverOperatorService } from './ever-operator.service';

/**
 * The identity of this installation, shared by the Ever Platform modules. It has no route, no timer
 * and no outbound request; it is not a plugin of its own, a plugin that needs it imports it.
 */
@Module({
	providers: [EverInstanceEvents, EverInstanceService, EverOperatorService],
	exports: [EverInstanceEvents, EverInstanceService, EverOperatorService]
})
export class EverInstanceModule {}
