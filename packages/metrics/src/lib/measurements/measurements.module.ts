import { Module } from '@nestjs/common';
import { TimeMetric } from './time';
import { MemoryMetric } from './memory';

@Module({
	imports: [],
	controllers: [],
	providers: [TimeMetric, MemoryMetric],
	exports: [TimeMetric, MemoryMetric]
})
export class MeasurementsModule {}
