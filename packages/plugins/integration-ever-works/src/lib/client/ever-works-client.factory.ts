import { Injectable } from '@nestjs/common';
import { EverWorksClient, EverWorksClientOptions } from './ever-works-client';
import { AxiosEverWorksTransport, EverWorksTransport } from './ever-works-transport';

/** What a caller states to get a client; the transport and the test seams are the factory's. */
export type EverWorksClientParams = Pick<EverWorksClientOptions, 'apiBaseUrl' | 'apiKey' | 'connectionId' | 'scopeSlug' | 'retry' | 'timeoutMs'>;

/**
 * Creates Ever Works clients over one shared transport (the SSRF-safe HTTPS agent). Tests replace the
 * factory (or `transport`) to reach the mock Ever Works server; production never allows plain HTTP or
 * private hosts.
 */
@Injectable()
export class EverWorksClientFactory {
	protected transport: EverWorksTransport = new AxiosEverWorksTransport();
	protected allowInsecureBaseUrlForTests = false;

	create(params: EverWorksClientParams): EverWorksClient {
		return new EverWorksClient({
			...params,
			transport: this.transport,
			allowInsecureBaseUrlForTests: this.allowInsecureBaseUrlForTests
		});
	}
}

/** A factory over another transport (the mock Ever Works server in tests). */
export class TestEverWorksClientFactory extends EverWorksClientFactory {
	constructor(transport: EverWorksTransport, options: { allowInsecure?: boolean } = {}) {
		super();
		this.transport = transport;
		this.allowInsecureBaseUrlForTests = options.allowInsecure ?? false;
	}
}
