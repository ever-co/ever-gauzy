import type { IAiProviderCredentials } from '@gauzy/plugin-ai-chat';
import { whisperCppProviderDefinition } from './ai-provider-whisper-cpp.provider';

// The SSRF egress guard resolves the provider host before the mocked `fetch` answers. Answer that
// lookup with a fixed public address, so no case waits on — or depends on — real DNS.
jest.mock('dns', () => ({
	...jest.requireActual('dns'),
	lookup: (_hostname: string, _options: unknown, callback: (error: null, addresses: unknown) => void) =>
		callback(null, [{ address: '93.184.215.14', family: 4 }])
}));

// The guard's transport opens real sockets and connects through its own address check. Hand its
// requests to the `global.fetch` stub each case installs instead: only the socket layer is replaced,
// while the URL check, the DNS pre-flight and the refusal of redirects all stay real.
jest.mock('../../../ai-chat/src/lib/ssrf/fetch-over-node-http', () => ({
	fetchOverNodeHttp: (input: string | URL | Request, init?: RequestInit) => global.fetch(input, init)
}));

/**
 * whisper.cpp is the LOCAL, key-less shape: no Authorization header when there is no key, the
 * `/inference` path (not OpenAI's), `response_format=json`, and the conventional default address.
 */
describe('whisperCppProviderDefinition', () => {
	const realFetch = global.fetch;
	const realAllowPrivate = process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS;
	afterEach(() => {
		global.fetch = realFetch;
		if (realAllowPrivate === undefined) {
			delete process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS;
		} else {
			process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS = realAllowPrivate;
		}
		jest.restoreAllMocks();
	});

	const capture = (body: unknown, init: ResponseInit = { status: 200 }) => {
		const fetchMock = jest.fn().mockImplementation(() =>
			Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init }))
		);
		global.fetch = fetchMock as unknown as typeof fetch;
		return fetchMock;
	};

	const noKey: IAiProviderCredentials = { apiKey: '', baseUrl: 'http://whisper.local:8080/', source: 'tenant' };

	it('is a local, key-less, voice-only provider', async () => {
		expect(whisperCppProviderDefinition.id).toBe('whisper-cpp');
		expect(whisperCppProviderDefinition.requiresApiKey).toBe(false);
		expect(whisperCppProviderDefinition.local).toBe(true);
		expect(whisperCppProviderDefinition.chatCapable).toBe(false);
		expect(whisperCppProviderDefinition.defaultBaseUrl).toBe('http://localhost:8080');
		expect(whisperCppProviderDefinition.baseUrlEnvVar).toBe('WHISPER_CPP_BASE_URL');
		await expect(whisperCppProviderDefinition.createModel('x', noKey)).rejects.toThrow(/cannot serve chat/);
	});

	it('posts multipart to {baseUrl}/inference with response_format=json and NO auth header when key-less', async () => {
		const fetchMock = capture({ text: ' hello from whisper.cpp ' });
		await expect(
			whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm;codecs=opus', noKey, {
				language: 'de'
			})
		).resolves.toBe('hello from whisper.cpp');

		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('http://whisper.local:8080/inference');
		expect('authorization' in (options.headers as Record<string, string>)).toBe(false);
		const form = options.body as FormData;
		expect(form.get('response_format')).toBe('json');
		expect(form.get('temperature')).toBe('0');
		expect(form.get('language')).toBe('de');
		expect(form.has('model')).toBe(false);
		expect((form.get('file') as File).name).toBe('dictation.webm');
	});

	it('falls back to the conventional local address and forwards a key as bearer when one is set', async () => {
		// The conventional address is loopback. It is the provider's OWN default, not tenant input, so
		// the SSRF egress guard lets it through without GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS.
		delete process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS;
		const fetchMock = capture({ text: 'ok' });
		await whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/mp4', {
			apiKey: 'proxy-token',
			source: 'environment'
		});
		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('http://localhost:8080/inference');
		expect((options.headers as Record<string, string>).authorization).toBe('Bearer proxy-token');
	});

	describe('private endpoints — who chose the address decides (GHSA-w3mx-m5cr-3gxp)', () => {
		beforeEach(() => {
			delete process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS;
		});

		it('refuses a TENANT-entered loopback base URL without making a request', async () => {
			const fetchMock = capture({ text: 'ok' });
			const tenant: IAiProviderCredentials = { apiKey: '', baseUrl: 'http://127.0.0.1:8080', source: 'tenant' };

			const error = (await whisperCppProviderDefinition
				.transcribe!(Buffer.from('audio'), 'audio/webm', tenant)
				.catch((e: unknown) => e)) as Error & { kind?: string };

			expect(error.kind).toBe('network');
			expect(error.message).toMatch(/not allowed/);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('allows the same tenant-entered address once the deployment opts in', async () => {
			process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS = 'true';
			const fetchMock = capture({ text: 'ok' });

			await expect(
				whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm', {
					apiKey: '',
					baseUrl: 'http://127.0.0.1:8080',
					source: 'tenant'
				})
			).resolves.toBe('ok');
			expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:8080/inference');
		});

		it("allows an operator's own private WHISPER_CPP_BASE_URL (environment source) without the opt-in", async () => {
			const fetchMock = capture({ text: 'ok' });

			await expect(
				whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm', {
					apiKey: '',
					baseUrl: 'http://10.0.0.7:8080',
					source: 'environment'
				})
			).resolves.toBe('ok');
			expect(String(fetchMock.mock.calls[0][0])).toBe('http://10.0.0.7:8080/inference');
		});

		/**
		 * Residual of the same advisory: the built-in default is LOOPBACK, so a tenant row with no base
		 * URL still made the server request `localhost:8080` — on shared hosting, whatever answers in
		 * the API pod. Saving the row is tenant input, so the deployment flag decides here too.
		 */
		it('refuses the built-in loopback default for a tenant row that carries no base URL', async () => {
			const fetchMock = capture({ text: 'ok' });

			const error = (await whisperCppProviderDefinition
				.transcribe!(Buffer.from('audio'), 'audio/webm', { apiKey: '', source: 'tenant' })
				.catch((e: unknown) => e)) as Error & { kind?: string };

			expect(error.kind).toBe('network');
			expect(error.message).toMatch(/not allowed/);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('allows that same built-in default once the deployment opts in', async () => {
			process.env.GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS = 'true';
			const fetchMock = capture({ text: 'ok' });

			await expect(
				whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm', {
					apiKey: '',
					source: 'tenant'
				})
			).resolves.toBe('ok');
			expect(String(fetchMock.mock.calls[0][0])).toBe('http://localhost:8080/inference');
		});

		it("allows it for an operator's own WHISPER_CPP_BASE_URL (environment source) with no opt-in", async () => {
			const fetchMock = capture({ text: 'ok' });

			await expect(
				whisperCppProviderDefinition.transcribe!(Buffer.from('audio'), 'audio/webm', {
					apiKey: '',
					source: 'environment'
				})
			).resolves.toBe('ok');
			expect(String(fetchMock.mock.calls[0][0])).toBe('http://localhost:8080/inference');
		});
	});

	it('reports a server that is not running as a network failure naming the provider', async () => {
		global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch;
		const error = (await whisperCppProviderDefinition
			.transcribe!(Buffer.from('audio'), 'audio/webm', noKey)
			.catch((e: unknown) => e)) as Error & { kind?: string };
		expect(error.kind).toBe('network');
		expect(error.message).toMatch(/^whisper\.cpp transcription failed: the server could not be reached/);
	});
});
