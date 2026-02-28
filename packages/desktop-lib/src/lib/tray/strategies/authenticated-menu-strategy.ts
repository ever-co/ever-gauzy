import { MenuItemConstructorOptions } from 'electron';
import { MenuItemBuilder } from '../builders/menu-item-builder';
import {
	CheckUpdateCommand,
	ExitAppCommand,
	LogoutCommand,
	OpenMainWindowCommand,
	OpenPluginsCommand,
	OpenSettingsCommand,
	OpenTimerCommand,
	StartTimerCommand,
	StopTimerCommand
} from '../commands';
import { IConfigStore, IMenuStrategy, ITranslationService, IWindowService } from '../interfaces';

/**
 * Strategy for building authenticated user menu
 */
export class AuthenticatedMenuStrategy implements IMenuStrategy {
	constructor(
		private translationService: ITranslationService,
		private windowService: IWindowService,
		private configStore: IConfigStore,
		private windowPath: any
	) {}

	buildMenu(): MenuItemConstructorOptions[] {
		const appConfig = this.configStore.getStore('configs');
		const menu: MenuItemConstructorOptions[] = [];

		// Timer status
		menu.push(
			new MenuItemBuilder()
				.withId('0')
				.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.NOW_TRACKING', { timer: '0h 00m' }))
				.withVisible(false)
				.build()
		);

		// Organization name placeholder
		menu.push(new MenuItemBuilder().withId('6').withLabel('').withVisible(false).withEnabled(false).build());

		// Start timer
		if (appConfig.timeTrackerWindow) {
			menu.push(
				new MenuItemBuilder()
					.withId('1')
					.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.START_TRACKING'))
					.withAccelerator('CmdOrCtrl+Shift+Space')
					.withCommand(new StartTimerCommand(this.windowService, this.configStore))
					.build()
			);

			// Stop timer
			menu.push(
				new MenuItemBuilder()
					.withId('2')
					.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.STOP_TRACKING'))
					.withEnabled(false)
					.withAccelerator('CmdOrCtrl+E')
					.withCommand(new StopTimerCommand(this.windowService))
					.build()
			);

			// Open timer
			menu.push(
				new MenuItemBuilder()
					.withId('3')
					.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.OPEN_TIMER'))
					.withAccelerator('CmdOrCtrl+O')
					.withCommand(new OpenTimerCommand(this.windowService))
					.build()
			);

			menu.push(new MenuItemBuilder().asSeparator().build());
		}

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

		// Settings
		menu.push(
			new MenuItemBuilder()
				.withId('4')
				.withLabel(this.translationService.instant('TIMER_TRACKER.SETUP.SETTING'))
				.withAccelerator('CmdOrCtrl+,')
				.withCommand(new OpenSettingsCommand(this.windowPath))
				.build()
		);

		// Main window (if gauzy)
		if (appConfig.gauzyWindow) {
			menu.push(
				new MenuItemBuilder()
					.withId('8')
					.withLabel(this.translationService.instant('TIMER_TRACKER.MENU.OPEN_MAIN_WINDOW'))
					.withCommand(new OpenMainWindowCommand(this.windowService))
					.build()
			);
		}

		menu.push(new MenuItemBuilder().asSeparator().build());

		// Logout
		if (process.env.IS_DESKTOP_TIMER === 'true') {
			menu.push(
				new MenuItemBuilder()
					.withId('7')
					.withLabel(this.translationService.instant('BUTTONS.LOGOUT'))
					.withAccelerator('CmdOrCtrl+L')
					.withCommand(new LogoutCommand(this.windowService, this.configStore))
					.build()
			);

			menu.push(new MenuItemBuilder().asSeparator().build());
		}

		// Exit
		menu.push(
			new MenuItemBuilder()
				.withId('5')
				.withLabel(this.translationService.instant('BUTTONS.EXIT'))
				.withAccelerator('CmdOrCtrl+Q')
				.withCommand(new ExitAppCommand())
				.build()
		);

		return menu;
	}
}
