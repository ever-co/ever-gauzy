import { Logger } from '@nestjs/common';
import { TimeMetric } from './time';

describe('TimeMetric', () => {
	let loggerSpy: jest.SpyInstance;

	beforeEach(async () => {
		loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('initialization', () => {
        it('should initialize with a logger when is not already initialized', () => {     
            const instance1 = TimeMetric.shared;
            const instance2 = TimeMetric.shared;
            expect(instance1).toBe(instance2);
            expect(loggerSpy).toHaveBeenCalledWith('TimeMetric initialized');
        });
	});
});
