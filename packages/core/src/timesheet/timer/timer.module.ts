import { Module } from '@nestjs/common';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';


@Module({
	controllers: [
		TimerController
	],
	imports: [],
	providers: [
		TimerService
	],
	exports: [
		TimerService
	]
})
export class TimerModule {}
