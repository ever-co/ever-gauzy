const mockProvider = { name: 'LOCAL', putFile: jest.fn(), getFile: jest.fn() };

jest.mock('@gauzy/core', () => ({
	FileStorage: class {
		getProvider() {
			return mockProvider;
		}
	}
}));

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INBOX_LOCAL_PROVIDER, InboxEmailStorage } from './inbox-email-storage';

describe('InboxEmailStorage', () => {
	let directory: string;

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-inbox-storage-'));
		process.env['GAUZY_INBOX_LOCAL_STORAGE_PATH'] = directory;
		mockProvider.name = 'LOCAL';
		jest.clearAllMocks();
	});

	afterEach(() => {
		delete process.env['GAUZY_INBOX_LOCAL_STORAGE_PATH'];
		rmSync(directory, { recursive: true, force: true });
	});

	it('keeps local files in its private directory (not the public asset root), creating the folders', async () => {
		const storage = new InboxEmailStorage();
		const stored = await storage.put(Buffer.from('raw'), 'inbox/t1/2026/10/a.eml');
		expect(stored).toEqual({ key: 'inbox/t1/2026/10/a.eml', provider: INBOX_LOCAL_PROVIDER });
		expect(readFileSync(join(directory, 'inbox', 't1', '2026', '10', 'a.eml'), 'utf8')).toBe('raw');
		expect((await storage.get(stored)).toString()).toBe('raw');
		expect(mockProvider.putFile).not.toHaveBeenCalled();
	});

	it('refuses a key that leaves the directory', async () => {
		await expect(new InboxEmailStorage().put(Buffer.from('x'), '../outside.eml')).rejects.toThrow(/leaves/);
	});

	it('uses the configured remote provider otherwise', async () => {
		mockProvider.name = 'S3';
		mockProvider.putFile.mockResolvedValue({ key: 'inbox/t1/b.eml' });
		mockProvider.getFile.mockResolvedValue(Buffer.from('remote'));
		const storage = new InboxEmailStorage();
		const stored = await storage.put(Buffer.from('remote'), 'inbox/t1/b.eml');
		expect(stored).toEqual({ key: 'inbox/t1/b.eml', provider: 'S3' });
		expect((await storage.get(stored)).toString()).toBe('remote');
	});
});
