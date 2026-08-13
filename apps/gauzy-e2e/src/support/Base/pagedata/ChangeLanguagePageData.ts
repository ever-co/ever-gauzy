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
	// Language-select option hooks. Options render as "[flag] Name" (flag <img> + translated name,
	// no code prefix) in a DB-driven order, so we pick options by the flag asset in their <img src>
	// — the only locale-invariant marker now that the code prefix is gone (language→country mapping
	// mirrors getLanguageFlagUrl in @gauzy/ui-core/shared).
	codeEnglish: 'flags/gb.svg',
	codeBulgarian: 'flags/bg.svg',
	codeRussian: 'flags/ru.svg',
	codeHebrew: 'flags/il.svg'
};
