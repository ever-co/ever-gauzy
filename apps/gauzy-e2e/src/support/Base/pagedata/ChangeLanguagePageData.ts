export const ChangeLanguagePageData = {
	// Translated "+ Create" header-button captions used to verify the active language.
	// The button text is `+ {{ 'BUTTONS.CREATE' | translate }}` (header.component.html), so these are
	// the current BUTTONS.CREATE values from packages/ui-core/i18n/assets/i18n/{bg,en,ru,he}.json.
	// NOTE: Bulgarian was re-translated since the Cypress version — was "+ Създаване", now "+ Създайте".
	// verifyLanguageIsChanged uses a contains-match, so the leading "+ " is tolerated either way.
	Bulgarian: 'Създайте',
	English: 'Create',
	Russian: 'Создать',
	Hebrew: 'צור',
	// Language-select option prefixes. Options render as "EN (English)" / "BG (Български)" etc.
	// (code + translated name) in a DB-driven order, so we pick options BY CODE PREFIX rather than by
	// the Cypress index (which assumed a fixed alphabetical order that the backend does not guarantee).
	codeEnglish: 'EN ',
	codeBulgarian: 'BG ',
	codeRussian: 'RU ',
	codeHebrew: 'HE '
};
