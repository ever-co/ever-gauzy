// cspell:ignore EENVELOPE EMESSAGE ESOCKET ECONNECTION ECONNREFUSED EPROTOCOL EHLO ESMTP HELO ehlo greylisted greylisting
import * as net from 'node:net';
import * as nodemailer from 'nodemailer';
import { classifyEmailSendError } from './email-retry.policy';

/**
 * The classifier against the errors nodemailer itself raises, from a fake SMTP server on 127.0.0.1 that answers each
 * step as a case says (no real server, no mail leaves the process). What matters here is what nodemailer reports at
 * each step, and in particular that a failure after the message body is reported with `command: 'CONN'` too, which is
 * why `CONN` alone never makes an error retryable.
 */

/** How the fake server answers each step: a reply line, `close` (drop the connection), or `silent` (never answer). */
interface IScript {
	greeting?: string;
	ehlo?: string;
	mail?: string;
	rcpt?: string;
	data?: string;
	/** The answer to the end of the message body. */
	end?: string;
}

const OK: Required<IScript> = {
	greeting: '220 fake.test ESMTP',
	ehlo: '250 fake.test',
	mail: '250 OK',
	rcpt: '250 OK',
	data: '354 go ahead',
	end: '250 queued'
};

interface IFakeServer {
	port: number;
	/** Whether the server received any of a message body. */
	bodyReceived: () => boolean;
	close: () => Promise<void>;
}

async function fakeSmtp(script: IScript): Promise<IFakeServer> {
	const steps = { ...OK, ...script };
	let bodyReceived = false;
	const sockets = new Set<net.Socket>();
	const server = net.createServer((socket) => {
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
		socket.on('error', () => undefined);
		const answer = (reply: string) => {
			if (reply === 'close') {
				socket.destroy();
			} else if (reply !== 'silent') {
				socket.write(`${reply}\r\n`);
			}
		};
		let inBody = false;
		let buffer = '';
		socket.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			let index: number;
			while ((index = buffer.indexOf('\r\n')) >= 0) {
				const line = buffer.slice(0, index);
				buffer = buffer.slice(index + 2);
				if (inBody) {
					bodyReceived = true;
					if (line === '.') {
						inBody = false;
						answer(steps.end);
					}
					continue;
				}
				const verb = line.toUpperCase();
				if (verb.startsWith('EHLO') || verb.startsWith('HELO')) answer(steps.ehlo);
				else if (verb.startsWith('MAIL FROM')) answer(steps.mail);
				else if (verb.startsWith('RCPT TO')) answer(steps.rcpt);
				else if (verb === 'DATA') {
					answer(steps.data);
					inBody = steps.data.startsWith('354');
				} else if (verb === 'QUIT') {
					answer('221 bye');
					socket.end();
				} else answer('502 unknown');
			}
		});
		answer(steps.greeting);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return {
		port: (server.address() as net.AddressInfo).port,
		bodyReceived: () => bodyReceived,
		close: () =>
			new Promise<void>((resolve) => {
				for (const socket of sockets) socket.destroy();
				server.close(() => resolve());
			})
	};
}

/** A port nothing listens on: one that was free a moment ago. */
async function closedPort(): Promise<number> {
	const server = net.createServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as net.AddressInfo;
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return port;
}

/** Sends one message through nodemailer's SMTP transport to the port; answers the error, or null when it went. */
async function sendTo(port: number, timeouts: { greetingTimeout?: number; socketTimeout?: number } = {}): Promise<any> {
	const transport = nodemailer.createTransport({
		host: '127.0.0.1',
		port,
		secure: false,
		ignoreTLS: true,
		connectionTimeout: 2_000,
		greetingTimeout: timeouts.greetingTimeout ?? 2_000,
		socketTimeout: timeouts.socketTimeout ?? 2_000
	});
	try {
		await transport.sendMail({
			from: 'noreply@gauzy.test',
			to: 'ada@example.test',
			subject: 'Welcome',
			html: '<p>Welcome</p>'
		});
		return null;
	} catch (error) {
		return error;
	} finally {
		transport.close();
	}
}

describe('classifyEmailSendError against nodemailer 10', () => {
	let server: IFakeServer | undefined;

	afterEach(async () => {
		await server?.close();
		server = undefined;
	});

	async function failureOf(script: IScript, timeouts?: { greetingTimeout?: number; socketTimeout?: number }) {
		server = await fakeSmtp(script);
		return sendTo(server.port, timeouts);
	}

	it('sends a message the fake server takes (the control)', async () => {
		expect(await failureOf({})).toBeNull();
		expect(server.bodyReceived()).toBe(true);
	});

	describe('retries what failed before the server could have accepted the message', () => {
		it('a refused connection', async () => {
			const error = await sendTo(await closedPort());
			expect(error).toMatchObject({ code: 'ESOCKET', originalCode: 'ECONNREFUSED', command: 'CONN' });
			expect(classifyEmailSendError(error).retry).toBe(true);
		});

		it('a greeting that never comes', async () => {
			const error = await failureOf({ greeting: 'silent' }, { greetingTimeout: 200 });
			expect(error).toMatchObject({ code: 'ETIMEDOUT', timeoutType: 'GREETING_TIMEOUT', command: 'CONN' });
			expect(classifyEmailSendError(error).retry).toBe(true);
		});

		it('a 421 greeting', async () => {
			const error = await failureOf({ greeting: '421 fake.test too many connections' });
			expect(error).toMatchObject({ code: 'EPROTOCOL', responseCode: 421, command: 'CONN' });
			expect(classifyEmailSendError(error).retry).toBe(true);
		});

		it('a 421 to EHLO', async () => {
			const error = await failureOf({ ehlo: '421 fake.test shutting down' });
			expect(error).toMatchObject({ code: 'ECONNECTION', responseCode: 421, command: 'EHLO' });
			expect(classifyEmailSendError(error).retry).toBe(true);
		});

		it('a 451 to MAIL FROM', async () => {
			const error = await failureOf({ mail: '451 4.3.0 try again later' });
			expect(error).toMatchObject({ code: 'EENVELOPE', responseCode: 451, command: 'MAIL FROM' });
			expect(classifyEmailSendError(error).retry).toBe(true);
			expect(server.bodyReceived()).toBe(false);
		});

		it('a greylisting 450 to RCPT TO', async () => {
			const error = await failureOf({ rcpt: '450 4.2.0 greylisted, come back later' });
			expect(error).toMatchObject({ code: 'EENVELOPE', responseCode: 450, command: 'RCPT TO' });
			expect(classifyEmailSendError(error).retry).toBe(true);
			expect(server.bodyReceived()).toBe(false);
		});
	});

	describe('never retries what failed during or after DATA, or for good', () => {
		it('a 550 to RCPT TO (no such mailbox)', async () => {
			const error = await failureOf({ rcpt: '550 5.1.1 no such user' });
			expect(error).toMatchObject({ code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' });
			expect(classifyEmailSendError(error).retry).toBe(false);
		});

		it('a 451 to DATA', async () => {
			const error = await failureOf({ data: '451 4.3.0 not now' });
			expect(error).toMatchObject({ code: 'EENVELOPE', responseCode: 451, command: 'DATA' });
			expect(classifyEmailSendError(error).retry).toBe(false);
		});

		it('a 451 to the end of the message body', async () => {
			const error = await failureOf({ end: '451 4.3.0 queue full' });
			expect(error).toMatchObject({ code: 'EMESSAGE', responseCode: 451, command: 'DATA' });
			expect(classifyEmailSendError(error).retry).toBe(false);
			expect(server.bodyReceived()).toBe(true);
		});

		it('a 421 to the end of the message body', async () => {
			const error = await failureOf({ end: '421 4.3.2 shutting down' });
			expect(error).toMatchObject({ responseCode: 421, command: 'DATA' });
			expect(classifyEmailSendError(error).retry).toBe(false);
		});

		it('🛑 a connection dropped after the whole body was sent, which nodemailer reports at CONN', async () => {
			const error = await failureOf({ end: 'close' });
			expect(server.bodyReceived()).toBe(true);
			expect(error).toMatchObject({ code: 'ECONNECTION', command: 'CONN' });
			expect(classifyEmailSendError(error).retry).toBe(false);
		});

		it('🛑 no answer after the whole body was sent, which nodemailer reports at CONN', async () => {
			const error = await failureOf({ end: 'silent' }, { socketTimeout: 300 });
			expect(server.bodyReceived()).toBe(true);
			expect(error).toMatchObject({ code: 'ETIMEDOUT', timeoutType: 'SOCKET_TIMEOUT', command: 'CONN' });
			expect(classifyEmailSendError(error).retry).toBe(false);
		});
	});
});
