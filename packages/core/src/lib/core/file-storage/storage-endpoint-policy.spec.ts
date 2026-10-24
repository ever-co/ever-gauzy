import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import {
	ALLOW_PRIVATE_STORAGE_ENDPOINTS_ENV,
	refusalForStorageEndpoint,
	refusalForStorageSettings,
	tenantStorageHttpsAgent
} from './storage-endpoint-policy';

/**
 * A tenant admin chose the Wasabi / DigitalOcean service URL and the Cloudinary delivery URL in the tenant's file
 * storage settings, and the API connected to them - `POST /tenant-setting/wasabi/validate` answered the S3 error back,
 * and a Cloudinary read answered the body back as the file. Those URLs must now point at a public HTTPS host.
 */
describe('storage endpoint policy', () => {
	const ENV: NodeJS.ProcessEnv = {};
	const OPTED_OUT: NodeJS.ProcessEnv = { [ALLOW_PRIVATE_STORAGE_ENDPOINTS_ENV]: 'true' };

	describe('refusalForStorageEndpoint', () => {
		it.each([
			'https://s3.wasabisys.com',
			's3.eu-central-1.wasabisys.com',
			'https://nyc3.digitaloceanspaces.com',
			'https://res.cloudinary.com/demo/image/upload/sample.jpg',
			'https://[2606:4700:4700::1111]/'
		])('allows the public endpoint %s', (url) => {
			expect(refusalForStorageEndpoint(url, ENV)).toBeUndefined();
		});

		it.each([
			['the metadata service', 'https://169.254.169.254/latest/meta-data/'],
			['the metadata service, without a scheme', '169.254.169.254'],
			['a loopback address', 'https://127.0.0.1:9000'],
			['a loopback address spelled as a number', 'https://2130706433/'],
			['a private address', 'https://10.0.0.5'],
			['an IPv6 loopback', 'https://[::1]:9000'],
			['an IPv4-mapped IPv6 metadata address', 'https://[::ffff:169.254.169.254]/'],
			['localhost', 'https://localhost:9000'],
			['a single-label cluster name', 'https://minio:9000'],
			['a special-use suffix', 'https://metadata.google.internal/'],
			['plain HTTP', 'http://s3.wasabisys.com'],
			['embedded credentials', 'https://user:secret@s3.wasabisys.com'],
			['a value that is not a URL', 123]
		])('refuses %s', (_label, url) => {
			expect(refusalForStorageEndpoint(url, ENV)).toEqual(expect.any(String));
		});

		it('allows anything when the installation opts out', () => {
			expect(refusalForStorageEndpoint('http://minio:9000', OPTED_OUT)).toBeUndefined();
			expect(refusalForStorageEndpoint('https://169.254.169.254', OPTED_OUT)).toBeUndefined();
		});
	});

	describe('refusalForStorageSettings', () => {
		it('names the refused setting', () => {
			expect(
				refusalForStorageSettings(
					{ fileStorageProvider: 'WASABI', wasabi_aws_service_url: 'https://169.254.169.254' },
					ENV
				)
			).toMatch(/^wasabi_aws_service_url: /);
			expect(refusalForStorageSettings({ digitalocean_service_url: 'http://10.0.0.1' }, ENV)).toMatch(
				/^digitalocean_service_url: /
			);
			expect(refusalForStorageSettings({ cloudinary_delivery_url: 'https://localhost' }, ENV)).toMatch(
				/^cloudinary_delivery_url: /
			);
		});

		it('passes public endpoints, blank endpoints and every other setting', () => {
			expect(
				refusalForStorageSettings(
					{
						wasabi_aws_service_url: 'https://s3.wasabisys.com',
						digitalocean_service_url: '  ',
						cloudinary_delivery_url: null,
						aws_bucket: 'http://10.0.0.1'
					},
					ENV
				)
			).toBeUndefined();
			expect(refusalForStorageSettings(undefined, ENV)).toBeUndefined();
		});
	});

	describe('tenantStorageHttpsAgent', () => {
		it('is one shared agent, and none when the installation opts out', () => {
			expect(tenantStorageHttpsAgent(ENV)).toBe(tenantStorageHttpsAgent(ENV));
			expect(tenantStorageHttpsAgent(OPTED_OUT)).toBeUndefined();
		});

		it('keeps an S3 client built with it off a host that resolves to a private address', async () => {
			// `localhost` resolves to the loopback address: the public-name check cannot see that, the connection can.
			const client = new S3Client({
				endpoint: 'https://localhost:9',
				region: 'us-east-1',
				credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
				forcePathStyle: true,
				maxAttempts: 1,
				requestHandler: { httpsAgent: tenantStorageHttpsAgent(ENV) }
			});
			try {
				await expect(client.send(new HeadBucketCommand({ Bucket: 'bucket' }))).rejects.toMatchObject({
					code: 'ESSRFBLOCKED'
				});
			} finally {
				client.destroy();
			}
		});
	});
});
