import { createHash, createHmac } from 'node:crypto';

/** AWS credentials (an access key; a session token for temporary ones). */
export interface AwsCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
}

/** A request to sign: its method, URL, headers (any case) and body. */
export interface SignableRequest {
	method: string;
	url: string;
	headers?: Record<string, string>;
	body?: string | Buffer;
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hmac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value, 'utf8').digest();

/** RFC 3986 encoding as SigV4 wants it (`encodeURIComponent` plus `!'()*`). */
const encode = (value: string) =>
	encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Signs a request with AWS Signature Version 4 (header form): answers the headers to send — the given ones plus
 * `host`, `x-amz-date`, `x-amz-content-sha256` (S3), `x-amz-security-token` (temporary credentials) and
 * `authorization`.
 * The path is used as given, each segment encoded once (S3 keys included).
 */
export function signAwsRequest(
	request: SignableRequest,
	credentials: AwsCredentials,
	region: string,
	service: string,
	now = new Date()
): Record<string, string> {
	const url = new URL(request.url);
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
	const day = amzDate.slice(0, 8);
	const payloadHash = sha256(request.body ?? '');
	const headers: Record<string, string> = {};
	for (const [name, value] of Object.entries(request.headers ?? {})) headers[name.toLowerCase()] = String(value);
	headers['host'] = url.host;
	headers['x-amz-date'] = amzDate;
	// S3 wants the payload's digest as a header too.
	if (service === 's3') headers['x-amz-content-sha256'] = payloadHash;
	if (credentials.sessionToken) headers['x-amz-security-token'] = credentials.sessionToken;

	const names = Object.keys(headers).sort();
	const canonicalHeaders = names.map((name) => `${name}:${headers[name]?.trim().replace(/\s+/g, ' ')}\n`).join('');
	const signedHeaders = names.join(';');
	const canonicalPath =
		url.pathname
			.split('/')
			.map((segment) => encode(decodeURIComponent(segment)))
			.join('/') || '/';
	const canonicalQuery = [...url.searchParams.entries()]
		.map(([key, value]) => [encode(key), encode(value)] as const)
		.sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
		.map(([key, value]) => `${key}=${value}`)
		.join('&');
	const canonicalRequest = [
		request.method.toUpperCase(),
		canonicalPath,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash
	].join('\n');
	const scope = `${day}/${region}/${service}/aws4_request`;
	const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
	const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), region), service), 'aws4_request');
	const signature = createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');
	return {
		...headers,
		authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
	};
}
