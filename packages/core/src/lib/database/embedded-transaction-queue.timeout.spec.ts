import {
	EMBEDDED_TRANSACTION_WAIT_TIMEOUT_ENV,
	EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS,
	resolveEmbeddedTransactionWaitTimeoutMs
} from './embedded-transaction-queue';

/**
 * The SQLite connection queue's wait ceiling is the deployment's to change.
 *
 * The default is knex's acquire timeout; a deployment that runs long seeds or imports on SQLite (the
 * demo, the desktop servers) raises it through the environment instead of a rebuild, and a value that
 * is not a positive number of milliseconds never replaces the default.
 */
describe('resolveEmbeddedTransactionWaitTimeoutMs', () => {
	it('keeps the default when the environment states nothing', () => {
		expect(resolveEmbeddedTransactionWaitTimeoutMs({})).toBe(EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS);
		expect(EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS).toBe(60_000);
	});

	it('takes a positive number of milliseconds from the environment', () => {
		expect(resolveEmbeddedTransactionWaitTimeoutMs({ [EMBEDDED_TRANSACTION_WAIT_TIMEOUT_ENV]: '300000' })).toBe(
			300_000
		);
		expect(resolveEmbeddedTransactionWaitTimeoutMs({ [EMBEDDED_TRANSACTION_WAIT_TIMEOUT_ENV]: ' 1500.9 ' })).toBe(
			1500
		);
	});

	it.each(['', '   ', '0', '-5', 'abc', 'Infinity'])('keeps the default for the unusable value %p', (value) => {
		expect(resolveEmbeddedTransactionWaitTimeoutMs({ [EMBEDDED_TRANSACTION_WAIT_TIMEOUT_ENV]: value })).toBe(
			EMBEDDED_TRANSACTION_WAIT_TIMEOUT_MS
		);
	});

	it('names the variable the sample environment documents', () => {
		expect(EMBEDDED_TRANSACTION_WAIT_TIMEOUT_ENV).toBe('DB_SQLITE_TRANSACTION_WAIT_TIMEOUT_MS');
	});
});
