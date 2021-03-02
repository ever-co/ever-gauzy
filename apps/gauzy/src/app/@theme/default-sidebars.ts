import { ISidebarConfig } from '../@core/services';
import { ChangelogComponent } from './components';

export const DEFAULT_SIDEBARS: { [id: string]: ISidebarConfig } = {
	changelog_sidebar: {
		loadComponent: () => ChangelogComponent,
		class: 'changelog-sidebar'
	}
	// settings_sidebar: {
	// 	loadComponent: () => ThemeSettingsComponent,
	// 	class: 'settings-sidebar'
	// }
};
