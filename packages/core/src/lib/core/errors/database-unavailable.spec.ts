import { createServer, Server, Socket } from 'node:net';
import {
	BadRequestException,
	HttpException,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { Client, DatabaseError, Pool } from 'pg';
import { QueryFailedError } from 'typeorm';
import { isDatabaseUnavailableError } from './database-unavailable';

/** A PostgreSQL error as `pg` raises it, with the given SQLSTATE. */
const postgresError = (code: string, message = 'server error') => {
	const error = new DatabaseError(message, message.length, 'error');
	error.code = code;
	return error;
};

/** TypeORM's wrapper around a driver error, as a failed query surfaces from a repository. */
const viaTypeOrm = (driverError: Error) => new QueryFailedError('SELECT 1', [], driverError);

/** A rejection's reason. */
const reasonOf = async (promise: Promise<unknown>): Promise<any> => {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error('expected the promise to reject');
};

/**
 * The 401-vs-503 decision of the auth strategies rests on this classifier: a false positive turns a
 * failure that has nothing to do with availability into a 503, a false negative keeps telling clients
 * during an outage that their valid token is bad. The driver errors below are produced by the installed
 * `pg` / `pg-pool` against local sockets, not copied by hand, so the wording the classifier matches is
 * checked against the library that actually raises it.
 */
describe('isDatabaseUnavailableError', () => {
	describe('errors raised by the installed pg / pg-pool', () => {
		const servers: Server[] = [];
		const sockets: Socket[] = [];

		/** A local TCP server; `onConnection` decides what a connecting client experiences. */
		const listen = async (onConnection: (socket: Socket) => void): Promise<number> => {
			const server = createServer((socket) => {
				sockets.push(socket);
				onConnection(socket);
			});
			servers.push(server);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			return (server.address() as { port: number }).port;
		};

		afterAll(async () => {
			sockets.forEach((socket) => socket.destroy());
			await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
		});

		it('recognizes an exhausted pool and a connection attempt that timed out', async () => {
			// A server that accepts and never answers: the one pooled connection never completes, and a
			// second checkout waits for a free connection until the pool gives up.
			const port = await listen(() => undefined);
			const pool = new Pool({ host: '127.0.0.1', port, max: 1, connectionTimeoutMillis: 100 });

			const [connecting, waiting] = await Promise.all([reasonOf(pool.connect()), reasonOf(pool.connect())]);
			await pool.end();

			expect(connecting.message).toBe('Connection terminated due to connection timeout');
			expect(waiting.message).toBe('timeout exceeded when trying to connect');
			expect(isDatabaseUnavailableError(connecting)).toBe(true);
			expect(isDatabaseUnavailableError(waiting)).toBe(true);
		});

		it('recognizes a pool that has been shut down', async () => {
			const pool = new Pool({ host: '127.0.0.1', port: 1 });
			await pool.end();

			const error = await reasonOf(pool.connect());
			expect(error.message).toBe('Cannot use a pool after calling end on the pool');
			expect(isDatabaseUnavailableError(error)).toBe(true);
		});

		it('recognizes a connection the server closed', async () => {
			const port = await listen((socket) => socket.end());

			const error = await reasonOf(new Client({ host: '127.0.0.1', port }).connect());
			expect(error.message).toBe('Connection terminated unexpectedly');
			expect(isDatabaseUnavailableError(error)).toBe(true);
			// ...and the same loss reported for a query, wrapped by TypeORM.
			expect(isDatabaseUnavailableError(viaTypeOrm(error))).toBe(true);
		});

		it('recognizes a connection the server reset or refused', async () => {
			const resetPort = await listen((socket) => socket.resetAndDestroy());
			const reset = await reasonOf(new Client({ host: '127.0.0.1', port: resetPort }).connect());

			// A port nobody listens on: take one, then free it.
			const refusedPort = await listen(() => undefined);
			await new Promise((resolve) => servers.pop()!.close(resolve));
			const refused = await reasonOf(new Client({ host: '127.0.0.1', port: refusedPort }).connect());

			expect(reset.code).toBe('ECONNRESET');
			expect(refused.code).toBe('ECONNREFUSED');
			expect(isDatabaseUnavailableError(reset)).toBe(true);
			expect(isDatabaseUnavailableError(refused)).toBe(true);
		});
	});

	it.each([
		['too_many_connections', '53300'],
		['admin_shutdown', '57P01'],
		['crash_shutdown', '57P02'],
		['cannot_connect_now', '57P03'],
		['query_canceled (statement_timeout)', '57014'],
		['connection_failure', '08006'],
		['connection_does_not_exist', '08003'],
		['sqlclient_unable_to_establish_sqlconnection', '08001']
	])('recognizes the PostgreSQL %s error, raw and wrapped by TypeORM', (_label, code) => {
		expect(isDatabaseUnavailableError(postgresError(code))).toBe(true);
		expect(isDatabaseUnavailableError(viaTypeOrm(postgresError(code)))).toBe(true);
	});

	it.each([
		['the pool-timeout text', 'Knex: Timeout acquiring a connection. The pool is probably full.'],
		[
			'a lost connection, prefixed with the SQL',
			'select "u0".* from "user" as "u0" - Connection terminated unexpectedly'
		]
	])('recognizes a MikroORM (knex) error carrying %s', (_label, message) => {
		const error = new Error(message);
		error.name = 'DriverException';
		expect(isDatabaseUnavailableError(error)).toBe(true);
	});

	it('looks through an Error.cause chain', () => {
		const lost = new Error('Connection terminated unexpectedly');
		expect(isDatabaseUnavailableError(new Error('lookup failed', { cause: lost }))).toBe(true);
	});

	describe('everything else stays what it was', () => {
		it.each([
			[
				'a unique violation',
				viaTypeOrm(postgresError('23505', 'duplicate key value violates unique constraint'))
			],
			['malformed input (not a uuid)', viaTypeOrm(postgresError('22P02', 'invalid input syntax for type uuid'))],
			['a missing table', viaTypeOrm(postgresError('42P01', 'relation "user" does not exist'))],
			['a serialization failure', postgresError('40001')],
			['a plain error', new Error('database is down')],
			['a TypeError from a bug', new TypeError("Cannot read properties of undefined (reading 'id')")],
			['a message that merely mentions a lost connection', new Error('Connection terminated by the user')],
			[
				'a message that quotes a pool timeout',
				new Error('Stripe: timeout exceeded when trying to connect, retry')
			],
			['a socket code with no syscall', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })],
			['a driver message on a plain object', { message: 'timeout exceeded when trying to connect' }]
		])('does not treat %s as an outage', (_label, error) => {
			expect(isDatabaseUnavailableError(error)).toBe(false);
		});

		it.each([
			new UnauthorizedException('unauthorized'),
			new NotFoundException('The requested record was not found'),
			new BadRequestException(),
			new ServiceUnavailableException(),
			new HttpException('wrapped', 500, { cause: new Error('timeout exceeded when trying to connect') })
		])('never treats an HttpException as an outage (%p), whatever its cause', (exception) => {
			expect(isDatabaseUnavailableError(exception)).toBe(false);
		});

		it.each([undefined, null, 'timeout exceeded when trying to connect', 503, {}])('ignores %p', (value) => {
			expect(isDatabaseUnavailableError(value)).toBe(false);
		});

		it('terminates on a circular cause chain', () => {
			const first = new Error('first');
			const second = new Error('second', { cause: first });
			(first as any).cause = second;
			expect(isDatabaseUnavailableError(first)).toBe(false);
		});
	});
});
