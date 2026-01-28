import { FileStorageProviderEnum } from '@gauzy/contracts';
import { WasabiS3Provider } from './wasabi-s3.provider';
import { IWasabiConfig, IWasabiConfigProvider } from './interfaces';

describe('WasabiS3Provider', () => {
	let provider: WasabiS3Provider;

	beforeEach(() => {
		provider = new WasabiS3Provider();
	});

	it('should be defined', () => {
		expect(provider).toBeDefined();
	});

	it('should have correct name matching FileStorageProviderEnum.WASABI', () => {
		expect(provider.name).toBe(FileStorageProviderEnum.WASABI);
	});

	describe('setConfig', () => {
		it('should set static configuration', () => {
			const config: IWasabiConfig = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				bucket: 'test-bucket',
				region: 'us-east-1'
			};

			provider.setConfig(config);

			expect(provider.config.wasabi_aws_access_key_id).toBe('test-access-key');
			expect(provider.config.wasabi_aws_bucket).toBe('test-bucket');
			expect(provider.config.wasabi_aws_default_region).toBe('us-east-1');
		});
	});

	describe('setConfigProvider', () => {
		it('should use dynamic config provider', () => {
			const mockProvider: IWasabiConfigProvider = {
				getConfig: jest.fn().mockReturnValue({
					accessKeyId: 'dynamic-key',
					secretAccessKey: 'dynamic-secret',
					bucket: 'dynamic-bucket',
					region: 'eu-west-1'
				})
			};

			provider.setConfigProvider(mockProvider);
			provider.getProviderInstance();

			expect(mockProvider.getConfig).toHaveBeenCalled();
			expect(provider.config.wasabi_aws_access_key_id).toBe('dynamic-key');
			expect(provider.config.wasabi_aws_default_region).toBe('eu-west-1');
		});
	});

	describe('path', () => {
		it('should return null for empty path', () => {
			expect(provider.path('')).toBeNull();
		});

		it('should return normalized path', () => {
			provider.setConfig({
				accessKeyId: 'key',
				secretAccessKey: 'secret',
				bucket: 'bucket',
				rootPath: 'root'
			});

			const result = provider.path('test/file.txt');
			expect(result).toBe('root/test/file.txt');
		});

		it('should normalize backslashes to forward slashes', () => {
			provider.setConfig({
				accessKeyId: 'key',
				secretAccessKey: 'secret',
				bucket: 'bucket',
				rootPath: ''
			});

			const result = provider.path('test\\file.txt');
			expect(result).toBe('test/file.txt');
		});
	});

	describe('url', () => {
		it('should return the same URL if it starts with http', async () => {
			const httpUrl = 'http://example.com/file.txt';
			const result = await provider.url(httpUrl);
			expect(result).toBe(httpUrl);
		});

		it('should return the same URL if it starts with https', async () => {
			const httpsUrl = 'https://example.com/file.txt';
			const result = await provider.url(httpsUrl);
			expect(result).toBe(httpsUrl);
		});

		it('should return null for empty URL', async () => {
			const result = await provider.url('');
			expect(result).toBeNull();
		});

		it('should return null when S3 client is not configured', async () => {
			const result = await provider.url('some/file.txt');
			expect(result).toBeNull();
		});
	});

	describe('getProviderInstance', () => {
		it('should return singleton instance', () => {
			const instance1 = provider.getProviderInstance();
			const instance2 = provider.getProviderInstance();
			expect(instance1).toBe(instance2);
		});
	});

	describe('getWasabiBucket', () => {
		it('should return configured bucket', () => {
			provider.setConfig({
				accessKeyId: 'key',
				secretAccessKey: 'secret',
				bucket: 'my-bucket'
			});

			expect(provider.getWasabiBucket()).toBe('my-bucket');
		});

		it('should return empty string when not configured', () => {
			expect(provider.getWasabiBucket()).toBe('');
		});
	});

	describe('fileExists', () => {
		it('should return false when S3 client is not configured', async () => {
			const result = await provider.fileExists('some/file.txt');
			expect(result).toBe(false);
		});
	});

	describe('config format', () => {
		it('should have config in FileSystem & IWasabiFileStorageProviderConfig format', () => {
			provider.setConfig({
				accessKeyId: 'key',
				secretAccessKey: 'secret',
				bucket: 'bucket',
				region: 'us-west-1',
				serviceUrl: 'https://s3.us-west-1.wasabisys.com',
				forcePathStyle: true,
				rootPath: '/root'
			});

			// Check FileSystem properties
			expect(provider.config.rootPath).toBe('/root');

			// Check IWasabiFileStorageProviderConfig properties
			expect(provider.config.wasabi_aws_access_key_id).toBe('key');
			expect(provider.config.wasabi_aws_secret_access_key).toBe('secret');
			expect(provider.config.wasabi_aws_bucket).toBe('bucket');
			expect(provider.config.wasabi_aws_default_region).toBe('us-west-1');
			expect(provider.config.wasabi_aws_service_url).toBe('https://s3.us-west-1.wasabisys.com');
			expect(provider.config.wasabi_aws_force_path_style).toBe(true);
		});
	});
});
