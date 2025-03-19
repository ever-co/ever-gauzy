import { Test } from '@nestjs/testing';
import { MemoryMetric } from './memory';
import { Logger } from '@nestjs/common';

describe('MemoryMetric', () => {
	let memoryMetric: MemoryMetric;
	let loggerSpy: jest.SpyInstance;

	beforeEach(async () => {
        loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();

		const moduleRef = await Test.createTestingModule({
			providers: [MemoryMetric]
		}).compile();
		memoryMetric = moduleRef.get<MemoryMetric>(MemoryMetric);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('initialization', () => {
		it('should initialize with a logger', () => {
			expect(memoryMetric).toBeDefined();
			expect(loggerSpy).toHaveBeenCalledWith('MemoryMetric initialized');
		});

		it('should return the same instance when accessing shared', () => {
			const instance1 = MemoryMetric.shared;
			const instance2 = MemoryMetric.shared;
			expect(instance1).toBe(memoryMetric);
			expect(instance1).toBe(instance2);
		});
	});

	describe('memory measurement', () => {
		it('should log memory status with the correct format', () => {
			// Mock process.memoryUsage to return predictable values
			const originalMemoryUsage = process.memoryUsage;

			// Use jest.spyOn instead of direct assignment
			jest.spyOn(process, 'memoryUsage').mockReturnValue({
				rss: 102400000, // 97.66 MB
				heapTotal: 51200000, // 48.83 MB
				heapUsed: 25600000, // 24.41 MB
				external: 10240000, // 9.77 MB
				arrayBuffers: 5120000 // 4.88 MB
			});

			memoryMetric.logStatus('test-label');

			expect(loggerSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Memory Usage (test-label): [Heap Used: 24.41Mb, Heap Total: 48.83Mb, RSS: 97.66Mb, External: 9.77Mb, Array Buffers: 4.88Mb]'
				)
			);

			// Restore original memoryUsage
			jest.spyOn(process, 'memoryUsage').mockRestore();
			process.memoryUsage = originalMemoryUsage;
		});

		it('should round memory values to 2 decimal places', () => {
			// Mock process.memoryUsage to return values that need rounding
			const originalMemoryUsage = process.memoryUsage;

			// Use jest.spyOn instead of direct assignment
			jest.spyOn(process, 'memoryUsage').mockReturnValue({
				rss: 102401234, // Should round to 97.66 MB
				heapTotal: 51203456, // Should round to 48.83 MB
				heapUsed: 25607890, // Should round to 24.42 MB
				external: 10241234, // Should round to 9.77 MB
				arrayBuffers: 5123456 // Should round to 4.89 MB
			});

			memoryMetric.logStatus('test-label');

			// Check that the values are rounded correctly
			expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Heap Used: 24.42Mb'));
			expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Heap Total: 48.83Mb'));
			expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('RSS: 97.66Mb'));
			expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('External: 9.77Mb'));
			expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Array Buffers: 4.89Mb'));

			// Restore original memoryUsage
			jest.spyOn(process, 'memoryUsage').mockRestore();
			process.memoryUsage = originalMemoryUsage;
		});
	});
});
