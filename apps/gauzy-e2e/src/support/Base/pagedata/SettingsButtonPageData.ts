export const SettingsButtonData = {
	// Light/Dark theme toggle now drives the body skin classes.
	lightTheme: 'nb-theme-gauzy-light',
	darkTheme: 'nb-theme-gauzy-dark',
	// Language options render as "[flag] Name" (no code prefix); the flag <img src> is the only
	// locale-invariant marker, so options are matched on the flag asset path (language→country
	// mapping mirrors getLanguageFlagUrl in @gauzy/ui-core/shared).
	languageEnglish: 'flags/gb.svg',
	languageBulgarian: 'flags/bg.svg',
	languageHebrew: 'flags/il.svg',
	languageRussian: 'flags/ru.svg',
	// Resulting language-button captions after selecting each language: the trigger shows the
	// selected language's name translated in the just-activated locale, i.e. its native name.
	langButtonEnglish: 'English',
	langButtonBulgarian: 'Български',
	langButtonHebrew: 'עִברִית',
	langButtonRussian: 'Русский',
	// Layout dropdown options.
	layoutGrid: 'Cards Grid',
	layoutTable: 'Table'
};
