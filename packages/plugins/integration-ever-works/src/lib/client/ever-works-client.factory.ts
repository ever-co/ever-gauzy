import { Inject, Injectable, Optional } from '@nestjs/common';
import type { EverWorksConfig } from '../ever-works-config';
import { EVER_WORKS_CONFIG } from '../ever-works.tokens';
import { EverWorksClient, EverWorksClientOptions } from './ever-works-client';
import { AxiosEverWorksTransport, EverWorksTransport } from './ever-works-transport';

/** What a caller states to get a client; the transport and the test seams are the factory's. */
export type EverWorksClientParams = Pick<EverWorksClientOptions, 'apiBaseUrl' | 'apiKey' | 'connectionId' | 'scopeSlug' | 'retry' | 'timeoutMs'>;

/**
 * Creates Ever Works clients over one shared transport (the SSRF-safe HTTPS agent). Tests replace the
 * factory (or `transport`) to reach the mock Ever Works server; production never allows plain HTTP or
 * private hosts. The development-only loopback switch (`EVER_WORKS_ALLOW_LOOPBACK`, read into the
 * config) admits a loopback Ever Works API and nothing else.
 */
@Injectable()
export class EverWorksClientFactory {
	protected transport: EverWorksTransport;
	protected allowInsecureBaseUrlForTests = false;
	protected readonly allowLoopback: boolean;

	constructor(@Optional() @Inject(EVER_WORKS_CONFIG) config?: Pick<EverWorksConfig, 'allowLoopback'> | null) {
		this.allowLoopback = config?.allowLoopback === true;
		this.transport = new AxiosEverWorksTransport({ allowLoopback: this.allowLoopback });
	}

	create(params: EverWorksClientParams): EverWorksClient {
		return new EverWorksClient({
			...params,
			transport: this.transport,
			allowInsecureBaseUrlForTests: this.allowInsecureBaseUrlForTests,
			allowLoopback: this.allowLoopback
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
