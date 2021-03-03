import { ISidebarConfig } from '../../../@core/services';
import { ChangelogComponent } from './changelog/changelog.component';
import { ThemeSettingsComponent } from './theme-settings/theme-settings.component';

export const DEFAULT_SIDEBARS: { [id: string]: ISidebarConfig } = {
	changelog_sidebar: {
		loadComponent: () => ChangelogComponent,
		class: 'changelog-sidebar',
		actionItem: {
			id: 'changelog_sidebar',
			label: 'changelog sidebar',
			icon: 'gift-outline',
			class: 'toggle-layout'
		}
	},
	settings_sidebar: {
		loadComponent: () => ThemeSettingsComponent,
		class: 'settings-sidebar',
		actionItem: {
			id: 'settings_sidebar',
			label: 'settings sidebar',
			icon: 'settings-2-outline',
			class: 'toggle-layout'
		}
	}
};
