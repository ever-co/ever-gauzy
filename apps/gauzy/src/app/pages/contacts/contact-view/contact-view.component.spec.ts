import { readFileSync } from 'fs';
import { join } from 'path';
import { PermissionsEnum } from '@gauzy/contracts';
import { ContactViewComponent } from './contact-view.component';

const I18N_DIR = join(__dirname, '../../../../../../../packages/ui-core/i18n/assets/i18n');
const LANGUAGES = ['ach', 'ar', 'bg', 'de', 'en', 'es', 'fr', 'he', 'it', 'nl', 'pl', 'pt', 'ru', 'zh'];

/** The contact page as a holder of the given permissions opens it. */
function contactViewFor(...granted: PermissionsEnum[]): ContactViewComponent {
	const store = { hasPermission: (permission: PermissionsEnum) => granted.includes(permission) };
	const unused = {} as never;
	return new ContactViewComponent(unused, unused, unused, store as never, unused, unused, unused);
}

/**
 * The contact page's Notes tab (ever-co/ever-gauzy#1114): shown to whoever the server lets read a contact's notes,
 * with the box for whoever it lets write them.
 */
describe('ContactViewComponent: the Notes tab', () => {
	it.each([
		['no contact permission', [], false, false],
		['ORG_CONTACT_VIEW', [PermissionsEnum.ORG_CONTACT_VIEW], true, false],
		[
			'ORG_CONTACT_VIEW and ORG_CONTACT_EDIT',
			[PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ORG_CONTACT_EDIT],
			true,
			true
		],
		[
			'ORG_CONTACT_ADD and ORG_CONTACT_DELETE',
			[PermissionsEnum.ORG_CONTACT_ADD, PermissionsEnum.ORG_CONTACT_DELETE],
			false,
			false
		]
	])('with %s: reads %s, writes %s', (_label, granted: PermissionsEnum[], reads, writes) => {
		const page = contactViewFor(...granted);

		expect(page.canReadNotes).toBe(reads);
		expect(page.canWriteNotes).toBe(writes);
	});

	it('attaches the notes to the contact', () => {
		expect(contactViewFor().documentEntity).toBe('OrganizationContact');
	});

	it.each(LANGUAGES)('names the notes with keys %s.json holds', (language) => {
		const dictionary = JSON.parse(readFileSync(join(I18N_DIR, `${language}.json`), 'utf8'));
		const keys = [...Object.values(contactViewFor().notesLabels), 'CONTACTS_PAGE.NOTES'];

		const missing = keys.filter((key) => {
			const value = key.split('.').reduce((node, part) => node?.[part], dictionary);
			return typeof value !== 'string' || !value.trim();
		});
		expect(missing).toEqual([]);
	});
});
