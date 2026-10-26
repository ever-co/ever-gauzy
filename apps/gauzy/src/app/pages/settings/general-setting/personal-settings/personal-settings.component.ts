import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NbThemeService } from '@nebular/theme';
import { ComponentLayoutStyleEnum, ILanguage, LanguagesEnum } from '@gauzy/contracts';
import { LanguagesService, Store, ToastrService, UsersService } from '@gauzy/ui-core/core';
import { getLanguageFlagUrl } from '@gauzy/ui-core/shared';
import {
	CORPORATE_THEME,
	COSMIC_THEME,
	DARK_THEME,
	DEFAULT_THEME,
	GAUZY_DARK,
	GAUZY_LIGHT,
	MATERIAL_DARK_THEME,
	MATERIAL_LIGHT_THEME
} from '@gauzy/ui-core/theme';

interface ThemeOption {
	value: string;
	name: string;
}

interface LanguageOption {
	code: string;
	name: string;
}

/** Same themes, in the same order, as the Quick Settings theme picker. */
const THEME_OPTIONS: ThemeOption[] = [
	{ value: GAUZY_LIGHT.name, name: 'SETTINGS_MENU.GAUZY_LIGHT' },
	{ value: GAUZY_DARK.name, name: 'SETTINGS_MENU.GAUZY_DARK' },
	{ value: DEFAULT_THEME.name, name: 'SETTINGS_MENU.LIGHT' },
	{ value: DARK_THEME.name, name: 'SETTINGS_MENU.DARK' },
	{ value: CORPORATE_THEME.name, name: 'SETTINGS_MENU.CORPORATE' },
	{ value: COSMIC_THEME.name, name: 'SETTINGS_MENU.COSMIC' },
	{ value: MATERIAL_LIGHT_THEME.name, name: 'SETTINGS_MENU.MATERIAL_LIGHT_THEME' },
	{ value: MATERIAL_DARK_THEME.name, name: 'SETTINGS_MENU.MATERIAL_DARK_THEME' }
];

/**
 * Settings → General: the signed-in user's account summary and personal preferences
 * (theme, language, default page layout).
 *
 * The controls write to the same Store slices and endpoints as the Quick Settings panel
 * (`PUT /user/preferred-language`, `PUT /user/preferred-layout`; the theme is a local
 * preference), so the two always agree and every change applies immediately.
 */
@Component({
	selector: 'ga-general-personal-settings',
	templateUrl: './personal-settings.component.html',
	styleUrls: ['./personal-settings.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PersonalSettingsComponent implements OnInit {
	private readonly store = inject(Store);
	private readonly usersService = inject(UsersService);
	private readonly languagesService = inject(LanguagesService);
	private readonly themeService = inject(NbThemeService);
	private readonly toastr = inject(ToastrService);

	public readonly themes = THEME_OPTIONS;
	public readonly layouts = Object.values(ComponentLayoutStyleEnum);

	public readonly user = toSignal(this.store.user$, { initialValue: this.store.user });
	public readonly currentTheme = toSignal(this.themeService.onThemeChange().pipe(map(({ name }) => name)), {
		initialValue: this.themeService.currentTheme
	});
	public readonly preferredLanguage = toSignal(this.store.preferredLanguage$, {
		initialValue: this.store.preferredLanguage
	});
	public readonly preferredLayout = toSignal(this.store.preferredComponentLayout$, {
		initialValue: this.store.preferredComponentLayout
	});
	private readonly systemLanguages = toSignal(this.store.systemLanguages$, {
		initialValue: this.store.systemLanguages
	});

	/** The tenant's enabled languages; every bundled language until they have loaded. */
	public readonly languages = computed<LanguageOption[]>(() => {
		const system = (this.systemLanguages() ?? []).filter((language: ILanguage) => language.is_system);
		if (system.length) {
			return system.map((language: ILanguage) => ({
				code: language.code,
				name: 'SETTINGS_MENU.' + language.name.toUpperCase()
			}));
		}
		return Object.entries(LanguagesEnum).map(([name, code]) => ({ code, name: 'SETTINGS_MENU.' + name }));
	});
	public readonly selectedLanguage = computed(() =>
		this.languages().find((language) => language.code === this.preferredLanguage())
	);

	public readonly fullName = computed(() => {
		const user = this.user();
		const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
		return name || user?.username || user?.email || '';
	});
	public readonly initials = computed(() =>
		this.fullName()
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('')
	);
	public readonly avatarFailed = signal(false);

	async ngOnInit(): Promise<void> {
		// The Quick Settings panel loads the language list lazily; load it here if nobody has yet.
		if (!this.store.systemLanguages) {
			try {
				const { items = [] } = await this.languagesService.getSystemLanguages();
				this.store.systemLanguages = items.filter((item: ILanguage) => item.is_system);
			} catch {
				// keep the bundled list
			}
		}
	}

	onThemeChange(theme: string): void {
		if (!theme || theme === this.currentTheme()) {
			return;
		}
		this.store.currentTheme = theme;
		this.themeService.changeTheme(theme);
	}

	async onLanguageChange(language: LanguagesEnum): Promise<void> {
		if (!language || language === this.preferredLanguage()) {
			return;
		}
		const previous = this.preferredLanguage();
		// The layout's ThemeLanguageSelectorService applies the language and text direction.
		this.store.preferredLanguage = language;
		try {
			await this.usersService.updatePreferredLanguage({ preferredLanguage: language });
		} catch {
			// Not saved: switch back, or the next load of the user's settings would do it silently.
			this.store.preferredLanguage = previous;
			this.toastr.danger('SETTINGS_GENERAL.PREFERENCES.SAVE_ERROR');
		}
	}

	async onLayoutChange(layout: ComponentLayoutStyleEnum): Promise<void> {
		if (!layout || layout === this.preferredLayout()) {
			return;
		}
		const previous = this.preferredLayout();
		this.store.preferredComponentLayout = layout;
		try {
			await this.usersService.updatePreferredComponentLayout({ preferredComponentLayout: layout });
		} catch {
			// Not saved: switch back, or the next load of the user's settings would do it silently.
			this.store.preferredComponentLayout = previous;
			this.toastr.danger('SETTINGS_GENERAL.PREFERENCES.SAVE_ERROR');
		}
	}

	/** Forgets the layout picked on individual pages, so every page uses the default again. */
	onResetPageLayouts(): void {
		this.store.componentLayout = [];
		this.toastr.success('SETTINGS_GENERAL.PREFERENCES.LAYOUTS_RESET');
	}

	flagUrl(code: string): string | null {
		return getLanguageFlagUrl(code);
	}

	onFlagError(event: Event): void {
		(event.target as HTMLImageElement).style.display = 'none';
	}
}
