import { MenuItemConstructorOptions } from 'electron';
import { MenuItemBuilder } from '../builders/menu-item-builder';
import {
	CheckUpdateCommand,
	ExitAppCommand,
	OpenMainWindowCommand,
	OpenPluginsCommand,
	OpenSettingsCommand,
	OpenTimerCommand
} from '../commands';
import { IConfigStore, IMenuStrategy, ITranslationService, IWindowService } from '../interfaces';

/**
 * Strategy for building unauthenticated user menu
 */
export class UnauthenticatedMenuStrategy implements IMenuStrategy {
	constructor(
		private translationService: ITranslationService,
		private windowService: IWindowService,
		private configStore: IConfigStore,
		private windowPath: any
	) {}

	buildMenu(): MenuItemConstructorOptions[] {
		const appConfig = this.configStore.getStore('configs');
		const menu: MenuItemConstructorOptions[] = [];

		// Main window (if gauzy)
		if (appConfig && appConfig.gauzyWindow) {
			menu.push(
				new MenuItemBuilder()
					.withId('8')
					.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.OPEN_MAIN_WINDOW'))
					.withCommand(new OpenMainWindowCommand(this.windowService))
					.build()
			);
		}

		// Open timer
		if (appConfig && appConfig.timeTrackerWindow) {
			menu.push(
				new MenuItemBuilder()
					.withId('3')
					.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.OPEN_TIMER'))
					.withAccelerator('CmdOrCtrl+O')
					.withCommand(new OpenTimerCommand(this.windowService))
					.build()
			);
		}

		// Settings
		menu.push(
			new MenuItemBuilder()
				.withId('4')
				.withLabel(this.translationService.instant('TIMER_TRACKER.SETUP.SETTING'))
				.withAccelerator('CmdOrCtrl+,')
				.withCommand(new OpenSettingsCommand(this.windowPath))
				.build()
		);

		// Plugins
		menu.push(
			new MenuItemBuilder()
				.withId('6-0')
				.withLabel(this.translationService.instant('TIMER_TRACKER.SETTINGS.PLUGINS'))
				.withAccelerator('CmdOrCtrl+P')
				.withCommand(new OpenPluginsCommand(this.windowPath))
				.build()
		);

		// Check update
		menu.push(
			new MenuItemBuilder()
				.withId('6')
				.withLabel(this.translationService.instant('BUTTONS.CHECK_UPDATE'))
				.withAccelerator('CmdOrCtrl+U')
				.withCommand(new CheckUpdateCommand(this.windowPath))
				.build()
		);

		menu.push(new MenuItemBuilder().asSeparator().build());

		// Exit
		menu.push(
			new MenuItemBuilder()
				.withId('0')
				.withLabel(this.translationService.instant('BUTTONS.EXIT'))
				.withAccelerator('CmdOrCtrl+Q')
				.withCommand(new ExitAppCommand())
				.build()
		);

		return menu;
	}
}
