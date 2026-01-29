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
		it('should initialize with default configuration when no config provided', () => {
			const defaultProvider = new LocalProvider();
			expect(defaultProvider.getRootPath()).toBe('public');
		});

		it('should set and get configuration via setConfig', () => {
			expect(provider.getRootPath()).toBe(testDir);
			expect(provider.config.baseUrl).toBe('http://localhost:3000');
			expect(provider.config.publicPath).toBe('public');
		});

		it('should have correct provider name', () => {
			expect(provider.name).toBe('LOCAL');
		});

		it('should get provider instance (singleton pattern)', () => {
			const instance = provider.getProviderInstance();
			expect(instance).toBe(provider);
		});

		it('should update config when setConfig is called multiple times', () => {
			provider.setConfig({
				rootPath: '/new/path',
				baseUrl: 'http://newurl.com',
				publicPath: 'assets'
			});
			expect(provider.getRootPath()).toBe('/new/path');
			expect(provider.config.baseUrl).toBe('http://newurl.com');
			expect(provider.config.publicPath).toBe('assets');
		});
	});

	describe('url()', () => {
		it('should return null for empty file path', async () => {
			const result = await provider.url('');
			expect(result).toBeNull();
		});

		it('should return null for null/undefined file path', async () => {
			const result = await provider.url(null as any);
			expect(result).toBeNull();
		});

		it('should return original URL for HTTP URLs', async () => {
			const httpUrl = 'http://example.com/image.png';
			const result = await provider.url(httpUrl);
			expect(result).toBe(httpUrl);
		});

		it('should return original URL for HTTPS URLs', async () => {
			const httpsUrl = 'https://example.com/image.png';
			const result = await provider.url(httpsUrl);
			expect(result).toBe(httpsUrl);
		});

		it('should generate URL with base URL and public path', async () => {
			const result = await provider.url('uploads/image.png');
			expect(result).toBe('http://localhost:3000/public/uploads/image.png');
		});

		it('should handle file paths with multiple segments', async () => {
			const result = await provider.url('uploads/2024/01/image.png');
			expect(result).toContain('http://localhost:3000');
			expect(result).toContain('public');
			expect(result).toContain('uploads/2024/01/image.png');
		});

		it('should handle file paths with special characters', async () => {
			const result = await provider.url('uploads/file name.png');
			expect(result).toBeDefined();
		});
	});

	describe('path()', () => {
		it('should return null for empty file path', () => {
			const result = provider.path('');
			expect(result).toBeNull();
		});

		it('should return null for null/undefined file path', () => {
			const result = provider.path(null as any);
			expect(result).toBeNull();
		});

		it('should return full path with root path', () => {
			const result = provider.path('uploads/image.png');
			expect(result).toContain(testDir);
			expect(result).toContain('uploads');
			expect(result).toContain('image.png');
		});

		it('should handle nested directory paths', () => {
			const result = provider.path('a/b/c/d/file.txt');
			expect(result).toContain(testDir);
			expect(result).toContain('a');
			expect(result).toContain('b');
			expect(result).toContain('c');
			expect(result).toContain('d');
			expect(result).toContain('file.txt');
		});
	});

	describe('putFile()', () => {
		it('should write file from Buffer content', async () => {
			const content = Buffer.from('Hello, World!');
			const filePath = 'test-buffer.txt';

			const uploaded = await provider.putFile(content, filePath);

			expect(uploaded).toBeDefined();
			expect(uploaded.filename).toBe('test-buffer.txt');
			expect(uploaded.key).toBeDefined();

			// Verify file exists on disk
			const fullPath = path.join(testDir, filePath);
			expect(fs.existsSync(fullPath)).toBe(true);
		});

		it('should write file from string content', async () => {
			const content = 'Hello, String Content!';
			const filePath = 'test-string.txt';

			const uploaded = await provider.putFile(content, filePath);

			expect(uploaded).toBeDefined();
			expect(uploaded.filename).toBe('test-string.txt');
		});

		it('should create nested directories automatically', async () => {
			const content = Buffer.from('Nested content');
			const filePath = 'deep/nested/path/file.txt';

			const uploaded = await provider.putFile(content, filePath);

			expect(uploaded).toBeDefined();
			expect(fs.existsSync(path.join(testDir, 'deep/nested/path/file.txt'))).toBe(true);
		});

		it('should overwrite existing file', async () => {
			const filePath = 'overwrite-test.txt';

			await provider.putFile(Buffer.from('Original content'), filePath);
			await provider.putFile(Buffer.from('New content'), filePath);

			const content = await provider.getFile(filePath);
			expect(content?.toString()).toBe('New content');
		});

		it('should return uploaded file with URL', async () => {
			const content = Buffer.from('URL test');
			const filePath = 'url-test.txt';

			const uploaded = await provider.putFile(content, filePath);

			expect(uploaded.url).toBeDefined();
			expect(uploaded.url).toContain('http://localhost:3000');
		});
	});

	describe('getFile()', () => {
		it('should read file content as Buffer', async () => {
			const originalContent = 'Test file content';
			const filePath = 'read-test.txt';

			await provider.putFile(Buffer.from(originalContent), filePath);
			const content = await provider.getFile(filePath);

			expect(content).toBeInstanceOf(Buffer);
			expect(content?.toString()).toBe(originalContent);
		});

		it('should return null for non-existent file', async () => {
			const result = await provider.getFile('non-existent-file.txt');
			expect(result).toBeNull();
		});

		it('should handle binary file content', async () => {
			// Create binary content (simulating an image)
			const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
			const filePath = 'binary-test.bin';

			await provider.putFile(binaryContent, filePath);
			const content = await provider.getFile(filePath);

			expect(content).toBeDefined();
			expect(content?.length).toBe(binaryContent.length);
			expect(content?.equals(binaryContent)).toBe(true);
		});

		it('should read file from nested path', async () => {
			const content = Buffer.from('Nested file content');
			const filePath = 'level1/level2/nested.txt';

			await provider.putFile(content, filePath);
			const readContent = await provider.getFile(filePath);

			expect(readContent?.toString()).toBe('Nested file content');
		});
	});

	describe('fileExists()', () => {
		it('should return false for non-existent file', async () => {
			const exists = await provider.fileExists('definitely-not-here.txt');
			expect(exists).toBe(false);
		});

		it('should return true for existing file', async () => {
			const filePath = 'exists-test.txt';
			await provider.putFile(Buffer.from('Content'), filePath);

			const exists = await provider.fileExists(filePath);
			expect(exists).toBe(true);
		});

		it('should return false for directory path', async () => {
			const dirPath = 'test-directory';
			fs.mkdirSync(path.join(testDir, dirPath), { recursive: true });

			const exists = await provider.fileExists(dirPath);
			expect(exists).toBe(false);
		});

		it('should handle nested file paths', async () => {
			const filePath = 'a/b/c/deep-file.txt';
			await provider.putFile(Buffer.from('Deep'), filePath);

			expect(await provider.fileExists(filePath)).toBe(true);
			expect(await provider.fileExists('a/b/c/not-here.txt')).toBe(false);
		});
	});

	describe('deleteFile()', () => {
		it('should delete existing file', async () => {
			const filePath = 'to-delete.txt';
			await provider.putFile(Buffer.from('Delete me'), filePath);

			expect(await provider.fileExists(filePath)).toBe(true);

			await provider.deleteFile(filePath);

			expect(await provider.fileExists(filePath)).toBe(false);
		});

		it('should not throw error when deleting non-existent file', async () => {
			await expect(provider.deleteFile('non-existent.txt')).resolves.not.toThrow();
		});

		it('should delete file from nested path', async () => {
			const filePath = 'nested/path/delete-me.txt';
			await provider.putFile(Buffer.from('Nested delete'), filePath);

			await provider.deleteFile(filePath);

			expect(await provider.fileExists(filePath)).toBe(false);
		});
	});

	describe('mapUploadedFile()', () => {
		it('should map file path to key', async () => {
			const file = {
				path: path.join(testDir, 'uploads', 'image.png'),
				originalname: 'image.png',
				size: 1024
			};

			const mapped = await provider.mapUploadedFile(file);

			expect(mapped.key).toBeDefined();
			expect(mapped.key).toContain('uploads');
			expect(mapped.key).toContain('image.png');
		});

		it('should generate URL for mapped file', async () => {
			const file = {
				path: path.join(testDir, 'uploads', 'document.pdf'),
				originalname: 'document.pdf',
				size: 2048
			};

			const mapped = await provider.mapUploadedFile(file);

			expect(mapped.url).toBeDefined();
			expect(mapped.url).toContain('http://localhost:3000');
		});

		it('should preserve original filename', async () => {
			const file = {
				path: path.join(testDir, 'photo.jpg'),
				originalname: 'my-vacation-photo.jpg',
				filename: 'photo.jpg',
				size: 5000
			};

			const mapped = await provider.mapUploadedFile(file);

			expect(mapped.filename).toBe('photo.jpg');
		});

		it('should normalize path separators in key', async () => {
			const file = {
				path: path.join(testDir, 'uploads', 'subfolder', 'file.txt'),
				originalname: 'file.txt',
				size: 100
			};

			const mapped = await provider.mapUploadedFile(file);

			// Key should use forward slashes regardless of platform
			expect(mapped.key).not.toContain('\\\\');
		});
	});

	describe('handler()', () => {
		it('should return a multer storage engine', () => {
			const storage = provider.handler({
				dest: 'uploads',
				prefix: 'file'
			});

			expect(storage).toBeDefined();
			expect(storage).toHaveProperty('_handleFile');
			expect(storage).toHaveProperty('_removeFile');
		});

		it('should handle function-based destination', () => {
			const storage = provider.handler({
				dest: (file: any) => `dynamic/${file.fieldname}`,
				prefix: 'upload'
			});

			expect(storage).toBeDefined();
		});

		it('should handle custom filename function', () => {
			const storage = provider.handler({
				dest: 'uploads',
				filename: (file: any, ext: string) => `custom-${Date.now()}.${ext}`,
				prefix: 'file'
			});

			expect(storage).toBeDefined();
		});
	});

	describe('end-to-end file lifecycle', () => {
		it('should complete full file lifecycle: create, read, update, delete', async () => {
			const filePath = 'lifecycle/test-file.txt';

			// CREATE
			const created = await provider.putFile(Buffer.from('Initial content'), filePath);
			expect(created).toBeDefined();
			expect(await provider.fileExists(filePath)).toBe(true);

			// READ
			let content = await provider.getFile(filePath);
			expect(content?.toString()).toBe('Initial content');

			// UPDATE
			await provider.putFile(Buffer.from('Updated content'), filePath);
			content = await provider.getFile(filePath);
			expect(content?.toString()).toBe('Updated content');

			// DELETE
			await provider.deleteFile(filePath);
			expect(await provider.fileExists(filePath)).toBe(false);
		});

		it('should handle multiple files simultaneously', async () => {
			const files = [
				{ path: 'multi/file1.txt', content: 'Content 1' },
				{ path: 'multi/file2.txt', content: 'Content 2' },
				{ path: 'multi/file3.txt', content: 'Content 3' }
			];

			// Create all files
			await Promise.all(files.map((f) => provider.putFile(Buffer.from(f.content), f.path)));

			// Verify all exist
			for (const file of files) {
				expect(await provider.fileExists(file.path)).toBe(true);
				const content = await provider.getFile(file.path);
				expect(content?.toString()).toBe(file.content);
			}

			// Delete all files
			await Promise.all(files.map((f) => provider.deleteFile(f.path)));

			// Verify all deleted
			for (const file of files) {
				expect(await provider.fileExists(file.path)).toBe(false);
			}
		});

		it('should handle large files', async () => {
			// Create a 1MB buffer
			const largeContent = Buffer.alloc(1024 * 1024, 'x');
			const filePath = 'large-file.bin';

			const uploaded = await provider.putFile(largeContent, filePath);
			expect(uploaded).toBeDefined();

			const content = await provider.getFile(filePath);
			expect(content?.length).toBe(largeContent.length);
		});
	});

	describe('error handling', () => {
		it('should handle file operations gracefully when rootPath is invalid', async () => {
			const invalidProvider = new LocalProvider();
			invalidProvider.setConfig({
				rootPath: '/definitely/invalid/path/that/does/not/exist',
				baseUrl: 'http://localhost',
				publicPath: 'public'
			});

			// getFile should return null for invalid path
			const content = await invalidProvider.getFile('some-file.txt');
			expect(content).toBeNull();
		});
	});
});
