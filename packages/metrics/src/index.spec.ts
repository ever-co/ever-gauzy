import * as metrics from './index';
import { MeasurementsModule } from './lib/measurements/measurements.module';
import { TimeMetric } from './lib/measurements/time';
import { MemoryMetric } from './lib/measurements/memory';

describe('Public API Surface', () => {
	it('should export MeasurementsModule', () => {
		expect(metrics.MeasurementsModule).toBeDefined();
		expect(metrics.MeasurementsModule).toBe(MeasurementsModule);
	});

	it('should export TimeMetric', () => {
		expect(metrics.TimeMetric).toBeDefined();
		expect(metrics.TimeMetric).toBe(TimeMetric);
	});

	it('should export MemoryMetric', () => {
		expect(metrics.MemoryMetric).toBeDefined();
		expect(metrics.MemoryMetric).toBe(MemoryMetric);
	});
});
