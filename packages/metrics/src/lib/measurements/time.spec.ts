import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TimeMetric } from './time';

describe('TimeMetric', () => {
	let timeMetric: TimeMetric;
	let loggerSpy: jest.SpyInstance;
	let mapSetSpy: jest.SpyInstance;
	let mapDeleteSpy: jest.SpyInstance;

	beforeEach(async () => {
		loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
		mapSetSpy = jest.spyOn(Map.prototype, 'set');
		mapDeleteSpy = jest.spyOn(Map.prototype, 'delete');

		const moduleRef = await Test.createTestingModule({
			providers: [TimeMetric]
		}).compile();

		timeMetric = moduleRef.get<TimeMetric>(TimeMetric);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('initialization', () => {
		it('should initialize with a logger', () => {
			expect(timeMetric).toBeDefined();
			expect(loggerSpy).toHaveBeenCalledWith('TimeMetric initialized');
		});

		it('should return the same instance when accessing shared', () => {
			const instance1 = TimeMetric.shared;
			const instance2 = TimeMetric.shared;
			expect(instance1).toBe(timeMetric);
			expect(instance1).toBe(instance2);
		});
	});

	describe('time measurement', () => {
		it('should start a timer', () => {
			// Mock process.hrtime to return a consistent value for testing
			const hrtimeSpy = jest.spyOn(process, 'hrtime').mockReturnValue([0, 0]);
			timeMetric.start('test-timer');
            expect(hrtimeSpy).toHaveBeenCalledTimes(1);
			expect(mapSetSpy).toHaveBeenCalledWith('test-timer', expect.any(Array));
		});

		it('should measure elapsed time', () => {
			// Mock process.hrtime to return predictable values
			const hrtimeSpy = jest
				.spyOn(process, 'hrtime')
				.mockReturnValueOnce([0, 0]) // For start
				.mockReturnValueOnce([1, 500000000]); // For measure: 1.5 seconds

			timeMetric.start('test-timer');
			const result = timeMetric.measure('test-timer');

			expect(result).toBe('1.50s');
			expect(hrtimeSpy).toHaveBeenCalledTimes(2);

			// Restore original hrtime
			hrtimeSpy.mockRestore();
		});

		it('should measure time in milliseconds for short durations', () => {
			// Mock process.hrtime to return predictable values
			const hrtimeSpy = jest
				.spyOn(process, 'hrtime')
				.mockReturnValueOnce([0, 0]) // For start
				.mockReturnValueOnce([0, 500000000]); // For measure: 0.5 seconds (500ms)

			timeMetric.start('test-timer');
			const result = timeMetric.measure('test-timer');

			expect(result).toBe('500.00ms');
			expect(hrtimeSpy).toHaveBeenCalledTimes(2);

			// Restore original hrtime
			hrtimeSpy.mockRestore();
		});

		it('should log an error when measuring a non-existent timer', () => {
			const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

			const result = timeMetric.measure('non-existent-timer');

			expect(errorSpy).toHaveBeenCalledWith('Timer non-existent-timer not found');
			expect(result).toBeUndefined();
		});

		it('should end a timer and return the duration', () => {
			// Mock process.hrtime to return predictable values
			const hrtimeSpy = jest
				.spyOn(process, 'hrtime')
				.mockReturnValueOnce([0, 0]) // For start
				.mockReturnValueOnce([0, 750000000]); // For end: 0.75 seconds (750ms)

			timeMetric.start('test-timer');
			const result = timeMetric.end('test-timer');

			expect(result).toBe('750.00ms');
			expect(mapDeleteSpy).toHaveBeenCalledWith('test-timer');
			expect(hrtimeSpy).toHaveBeenCalledTimes(2);

			// Restore original hrtime
			hrtimeSpy.mockRestore();
		});
	});
});
