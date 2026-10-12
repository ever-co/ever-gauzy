jest.mock('@gauzy/config', () => ({ isDevelopment: jest.fn() }));

import { isDevelopment } from '@gauzy/config';
import { debugInDevelopment } from './debug-in-development';

describe('debugInDevelopment', () => {
	const logger = { debug: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn() };
	const message = jest.fn(() => 'built message');

	beforeEach(() => jest.clearAllMocks());

	it('builds and emits the message in a development runtime', () => {
		(isDevelopment as jest.Mock).mockReturnValue(true);
		debugInDevelopment(logger, message);
		expect(message).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith('built message');
	});

	it('neither builds nor emits the message outside development', () => {
		(isDevelopment as jest.Mock).mockReturnValue(false);
		debugInDevelopment(logger, message);
		expect(message).not.toHaveBeenCalled();
		expect(logger.debug).not.toHaveBeenCalled();
	});
});
