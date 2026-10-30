/**
 * #10674: the local provider joined a stored key to its root folder without checking the result, so a key with
 * ".." segments could read, write or delete files outside the public folder. These tests run against a real
 * temporary folder: a root (`public`) and a sibling (`public-secret`) whose name starts with the root's, so a
 * naive "starts with the root" check would let it through.
 */
jest.mock('@gauzy/config', () => ({
	environment: { baseUrl: 'http://localhost:3000', isElectron: false },
	getConfig: () => ({ assetOptions: {} })
}));

import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalProvider } from './local.provider';

describe('LocalProvider — keys stay inside the root folder (#10674)', () => {
	let base: string;
	let root: string;
	let secret: string;
	let provider: LocalProvider;

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		base = fs.mkdtempSync(join(tmpdir(), 'gauzy-local-provider-'));
		root = join(base, 'public');
		fs.mkdirSync(join(root, 'uploads'), { recursive: true });
		fs.writeFileSync(join(root, 'uploads', 'inside.txt'), 'inside');
		fs.writeFileSync(join(root, '..notes.txt'), 'dots in a name');

		fs.mkdirSync(join(base, 'public-secret'));
		secret = join(base, 'public-secret', 'secret.txt');
		fs.writeFileSync(secret, 'secret');
		fs.writeFileSync(join(base, 'outside.txt'), 'outside');

		provider = new LocalProvider();
		provider.config = { rootPath: root, baseUrl: 'http://localhost:3000' };
	});

	afterEach(() => {
		fs.rmSync(base, { recursive: true, force: true });
	});

	it('maps an ordinary key to the same path as before', () => {
		expect(provider.path('uploads/inside.txt')).toBe(join(root, 'uploads/inside.txt'));
		expect(provider.path('')).toBeNull();
	});

	it('refuses keys that resolve outside the root, including a sibling folder that shares its prefix', () => {
		expect(provider.path('../outside.txt')).toBeNull();
		expect(provider.path('uploads/../../outside.txt')).toBeNull();
		expect(provider.path('../public-secret/secret.txt')).toBeNull();
		expect(provider.path('..')).toBeNull();
	});

	it('keeps keys whose ".." segments stay inside the root, and names that merely start with dots', () => {
		expect(provider.path('uploads/../uploads/inside.txt')).toBe(join(root, 'uploads', 'inside.txt'));
		expect(provider.path('..notes.txt')).toBe(join(root, '..notes.txt'));
	});

	it('reads a key inside the root, and treats an escaping key as a missing file', async () => {
		expect((await provider.getFile('uploads/inside.txt')).toString()).toBe('inside');
		expect((await provider.getFile('..notes.txt')).toString()).toBe('dots in a name');

		// Before the fix these returned the outside files' content.
		expect(await provider.getFile('../outside.txt')).toBeUndefined();
		expect(await provider.getFile('../public-secret/secret.txt')).toBeUndefined();
	});

	it('never deletes a file outside the root, and still deletes one inside it', async () => {
		await provider.deleteFile('../outside.txt');
		await provider.deleteFile('../public-secret/secret.txt');

		expect(fs.existsSync(join(base, 'outside.txt'))).toBe(true);
		expect(fs.existsSync(secret)).toBe(true);

		await provider.deleteFile('uploads/inside.txt');

		expect(fs.existsSync(join(root, 'uploads', 'inside.txt'))).toBe(false);
	});

	it('deleteFileOrFail throws for a key outside the root, where deleteFile resolves, and deletes one inside it', async () => {
		await expect(provider.deleteFile('../outside.txt')).resolves.toBeUndefined();
		await expect(provider.deleteFileOrFail('../outside.txt')).rejects.toThrow(/outside the storage root/);
		await expect(provider.deleteFileOrFail('../public-secret/secret.txt')).rejects.toThrow(/outside the storage root/);

		expect(fs.existsSync(join(base, 'outside.txt'))).toBe(true);
		expect(fs.existsSync(secret)).toBe(true);

		await provider.deleteFileOrFail('uploads/inside.txt');

		expect(fs.existsSync(join(root, 'uploads', 'inside.txt'))).toBe(false);
		// A file that is not there is already gone.
		await expect(provider.deleteFileOrFail('uploads/inside.txt')).resolves.toBeUndefined();
	});

	it('deleteFileOrFail throws when the file cannot be unlinked, where existsSync would have hidden it', async () => {
		// A directory the process may not traverse: `existsSync` answers false, and `deleteFile` resolves untouched.
		const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
		const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
		const unlink = jest.spyOn(fs.promises, 'unlink').mockRejectedValue(denied);

		try {
			await expect(provider.deleteFile('uploads/inside.txt')).resolves.toBeUndefined();
			await expect(provider.deleteFileOrFail('uploads/inside.txt')).rejects.toBe(denied);
			expect(unlink).toHaveBeenCalledWith(join(root, 'uploads/inside.txt'));
		} finally {
			exists.mockRestore();
			unlink.mockRestore();
		}

		expect(fs.existsSync(join(root, 'uploads', 'inside.txt'))).toBe(true);
	});

	it('answers 400 to a write outside the root and writes nothing there', async () => {
		const attempt = provider.putFile(Buffer.from('written'), '../public-secret/planted.txt');

		await expect(attempt).rejects.toBeInstanceOf(HttpException);
		await attempt.catch((error: HttpException) => expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST));
		expect(fs.existsSync(join(base, 'public-secret', 'planted.txt'))).toBe(false);
	});

	it('still writes a file inside the root', async () => {
		const uploaded = await provider.putFile(Buffer.from('written'), 'uploads/new.txt');

		expect(fs.readFileSync(join(root, 'uploads', 'new.txt'), 'utf8')).toBe('written');
		expect(uploaded.filename).toBe('new.txt');
	});
});
