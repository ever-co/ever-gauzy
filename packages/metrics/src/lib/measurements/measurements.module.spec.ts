import { Test } from '@nestjs/testing';
import { MeasurementsModule } from './measurements.module';
import { TimeMetric } from './time';
import { MemoryMetric } from './memory';

describe('MeasurementsModule', () => {
	let timeMetric: TimeMetric;
	let memoryMetric: MemoryMetric;

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [MeasurementsModule]
		}).compile();

		timeMetric = moduleRef.get<TimeMetric>(TimeMetric);
		memoryMetric = moduleRef.get<MemoryMetric>(MemoryMetric);
	});

	it('should provide TimeMetric', () => {
		expect(timeMetric).toBeDefined();
		expect(timeMetric).toBeInstanceOf(TimeMetric);
	});

	it('should provide MemoryMetric', () => {
		expect(memoryMetric).toBeDefined();
		expect(memoryMetric).toBeInstanceOf(MemoryMetric);
	});

	it('should provide the same instance of TimeMetric when accessing shared', () => {
		expect(TimeMetric.shared).toBe(timeMetric);
	});

	it('should provide the same instance of MemoryMetric when accessing shared', () => {
		expect(MemoryMetric.shared).toBe(memoryMetric);
	});
});
