import { Logger } from '@nestjs/common';
import { MemoryMetric } from './memory';

describe('MemoryMetric', () => {
	let loggerSpy: jest.SpyInstance;

	beforeEach(async () => {
		loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('initialization', () => {
        it('should initialize with a logger when is not already initialized', () => {     
            const instance1 = MemoryMetric.shared;
            const instance2 = MemoryMetric.shared;
            expect(instance1).toBe(instance2);
            expect(loggerSpy).toHaveBeenCalledWith('MemoryMetric initialized');
        });
	});
});
