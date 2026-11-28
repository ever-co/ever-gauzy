import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * The assistant is called "Ever SI" in every Ever app and every language (the shared shell's rule): never "AI
 * Assistant", "AI Chat" or "Chat". Its name is a brand, so every catalog carries it as is.
 */
describe('the assistant is named Ever SI in every catalog', () => {
	const directory = join(__dirname, '..', '..', 'assets', 'i18n');
	const catalogs = readdirSync(directory).filter((file) => file.endsWith('.json'));

	it('reads all 14 catalogs', () => {
		expect(catalogs.length).toBe(14);
	});

	it.each(catalogs)('%s', (file) => {
		const catalog = JSON.parse(readFileSync(join(directory, file), 'utf-8'));
		expect(catalog.HEADER.AI_CHAT).toBe('Ever SI');
		expect(catalog.AI_ASSISTANT.TITLE).toBe('Ever SI');
		for (const key of ['OPEN', 'CLOSE', 'ERROR_NOT_CONFIGURED', 'ERROR_NOT_CONFIGURED_ASK_ADMIN']) {
			expect(catalog.AI_ASSISTANT[key]).toContain('Ever SI');
		}
		const permissions = catalog.ORGANIZATIONS_PAGE.PERMISSIONS;
		expect(permissions.AI_CHAT_ACCESS).toContain('Ever SI');
		expect(permissions.AI_CHAT_SETTINGS).toContain('Ever SI');
		expect(permissions.DESCRIPTIONS.AI_CHAT_ACCESS).toContain('Ever SI');
		expect(permissions.DESCRIPTIONS.AI_CHAT_SETTINGS).toContain('Ever SI');
	});
});
