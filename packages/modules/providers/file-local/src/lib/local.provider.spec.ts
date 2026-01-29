import * as fs from 'fs';
import * as path from 'path';
import { LocalProvider } from './local.provider';

describe('LocalProvider', () => {
	let provider: LocalProvider;
	const testDir = path.join(__dirname, '..', '..', '..', '.test-files');

	beforeEach(() => {
		provider = new LocalProvider();
		provider.setConfig({
			rootPath: testDir,
			baseUrl: 'http://localhost:3000',
			publicPath: 'public'
		});

		// Ensure test directory exists
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir, { recursive: true });
		}
	});

	afterEach(() => {
		// Cleanup test files after each test
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	afterAll(() => {
		// Final cleanup to ensure test directory is removed
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('configuration', () => {
		it('should set and get configuration', () => {
			expect(provider.getRootPath()).toBe(testDir);
		});

		it('should have correct provider name', () => {
			expect(provider.name).toBe('LOCAL');
		});

		it('should get provider instance', () => {
			const instance = provider.getProviderInstance();
			expect(instance).toBe(provider);
		});
	});

	describe('url()', () => {
		it('should return null for empty file path', async () => {
			const result = await provider.url('');
			expect(result).toBeNull();
		});

		it('should return original URL for external URLs', async () => {
			const externalUrl = 'https://example.com/image.png';
			const result = await provider.url(externalUrl);
			expect(result).toBe(externalUrl);
		});

		it('should generate URL with base URL', async () => {
			const result = await provider.url('uploads/image.png');
			expect(result).toContain('http://localhost:3000');
			expect(result).toContain('public');
			expect(result).toContain('uploads/image.png');
		});
	});

	describe('path()', () => {
		it('should return null for empty file path', () => {
			const result = provider.path('');
			expect(result).toBeNull();
		});

		it('should return full path with root path', () => {
			const result = provider.path('uploads/image.png');
			expect(result).toContain(testDir);
			expect(result).toContain('uploads');
			expect(result).toContain('image.png');
		});
	});

	describe('file operations', () => {
		it('should write and read file', async () => {
			const content = Buffer.from('Hello, World!');
			const filePath = 'test-file.txt';

			// Write file
			const uploaded = await provider.putFile(content, filePath);
			expect(uploaded).toBeDefined();
			expect(uploaded.filename).toBe('test-file.txt');

			// Read file
			const readContent = await provider.getFile(filePath);
			expect(readContent?.toString()).toBe('Hello, World!');
		});

		it('should check file existence', async () => {
			const content = Buffer.from('Test content');
			const filePath = 'existence-test.txt';

			// File should not exist initially
			expect(await provider.fileExists(filePath)).toBe(false);

			// Write file
			await provider.putFile(content, filePath);

			// File should exist now
			expect(await provider.fileExists(filePath)).toBe(true);
		});

		it('should delete file', async () => {
			const content = Buffer.from('To be deleted');
			const filePath = 'delete-test.txt';

			// Write file
			await provider.putFile(content, filePath);
			expect(await provider.fileExists(filePath)).toBe(true);

			// Delete file
			await provider.deleteFile(filePath);
			expect(await provider.fileExists(filePath)).toBe(false);
		});

		it('should return null for non-existent file', async () => {
			const result = await provider.getFile('non-existent.txt');
			expect(result).toBeNull();
		});
	});

	describe('mapUploadedFile()', () => {
		it('should map file with key and generate URL', async () => {
			const file = {
				path: path.join(testDir, 'uploads', 'image.png'),
				originalname: 'image.png',
				size: 1024
			};

			const mapped = await provider.mapUploadedFile(file);
			expect(mapped.key).toBeDefined();
			expect(mapped.url).toBeDefined();
		});
	});
});
