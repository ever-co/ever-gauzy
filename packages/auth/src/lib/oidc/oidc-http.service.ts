import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

/** User agent sent with every request the library makes. */
export const OIDC_USER_AGENT = 'gauzy-oidc/1';

/** Per-request timeout, milliseconds. */
export const OIDC_HTTP_TIMEOUT_MS = 10_000;

/** Largest response body accepted from an issuer, bytes. Discovery documents and key sets are small. */
export const OIDC_MAX_RESPONSE_BYTES = 1024 * 1024;

/** A response as the library sees it: the status and the parsed body. */
export interface OidcHttpResponse {
	status: number;
	data: unknown;
}

/**
 * The single place the library makes outbound HTTP requests.
 *
 * Every request follows the same rules: no redirects are followed, a 10 s timeout applies, the body
 * size is capped, and the status code is returned to the caller instead of being thrown, so each
 * caller decides what a non-2xx answer means. Only the URLs the callers pass are ever requested;
 * callers only pass endpoints that share the configured issuer's origin.
 */
@Injectable()
export class OidcHttpService {
	constructor(private readonly httpService: HttpService) {}

	/**
	 * Sends a GET request and returns the status and parsed JSON body.
	 *
	 * @param url - Absolute URL.
	 * @param headers - Extra request headers.
	 * @returns The response.
	 */
	async get(url: string, headers: Record<string, string> = {}): Promise<OidcHttpResponse> {
		const response = await firstValueFrom(
			this.httpService.get(url, this.options({ Accept: 'application/json', ...headers }))
		);
		return { status: response.status, data: response.data };
	}

	/**
	 * Sends an `application/x-www-form-urlencoded` POST request.
	 *
	 * @param url - Absolute URL.
	 * @param form - Form fields.
	 * @param headers - Extra request headers.
	 * @returns The response.
	 */
	async postForm(
		url: string,
		form: Record<string, string>,
		headers: Record<string, string> = {}
	): Promise<OidcHttpResponse> {
		const body = new URLSearchParams(form).toString();
		const response = await firstValueFrom(
			this.httpService.post(
				url,
				body,
				this.options({
					Accept: 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded',
					...headers
				})
			)
		);
		return { status: response.status, data: response.data };
	}

	private options(headers: Record<string, string>): AxiosRequestConfig {
		return {
			headers: { 'User-Agent': OIDC_USER_AGENT, ...headers },
			timeout: OIDC_HTTP_TIMEOUT_MS,
			maxRedirects: 0,
			maxContentLength: OIDC_MAX_RESPONSE_BYTES,
			maxBodyLength: OIDC_MAX_RESPONSE_BYTES,
			responseType: 'json',
			// The status is the caller's to judge; a 400 from a token endpoint is an answer, not a crash.
			validateStatus: () => true
		};
	}
}
