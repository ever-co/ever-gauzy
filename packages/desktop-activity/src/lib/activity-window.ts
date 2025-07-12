
import { TWindowActivities } from './i-kb-mouse';

export type TActiveWindowResult = {
  platform: 'macos' | 'linux' | 'windows';
  title: string;
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  contentBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  owner: {
    name: string;
    processId: number;
    bundleId?: string;
    path: string;
  };
  url?: string;
  memoryUsage: number;
};

export type TActiveWindowOption = {
	accessibilityPermission: boolean,
	screenRecordingPermission: boolean
}

export class ActivityWindow {
	private static instance: ActivityWindow;
	private windowActivities: Map<string, TWindowActivities>;
	private _getWindows: (() => Promise<TActiveWindowResult>) | null;
	private constructor() {
		this.windowActivities = new Map();
		this._getWindows = null;
	}

	public static getInstance(): ActivityWindow {
		if (!ActivityWindow.instance) {
			ActivityWindow.instance = new ActivityWindow();
		}
		return ActivityWindow.instance;
	}

	public async getActiveWindow(options: TActiveWindowOption): Promise<TActiveWindowResult> {
		const moduleActiveWindow = await this._loadGetWindows();
		return moduleActiveWindow({
			accessibilityPermission: options.accessibilityPermission,
			screenRecordingPermission: options.screenRecordingPermission
		});
	}

	private updateWindowActivities(windowActivity: TWindowActivities) {
		if (this.windowActivities.has(windowActivity.name)) {
			const currentApp = this.windowActivities.get(windowActivity.name);
			currentApp.duration += windowActivity.duration;
			currentApp.dateEnd = windowActivity.dateEnd;
			if (!currentApp.meta.some((mt) => mt.title === windowActivity.meta[0].title)) {
				currentApp.meta.push(...windowActivity.meta);
			}
			this.windowActivities.set(windowActivity.name, currentApp);
		} else {
			this.windowActivities.set(windowActivity.name, windowActivity);
		}
	}

	public async getActiveWindowAndSetDuration() {
		/**
		* Setting these to true would prompt a system dialog on macOS every time the function is called.
		* Therefore, they are kept false to avoid interrupting the user experience.
		* */
		const currentActiveWindow = await this.getActiveWindow({
			accessibilityPermission: false,
			screenRecordingPermission: false
		});
		if (currentActiveWindow) {
			this.updateWindowActivities({
				name: currentActiveWindow.owner.name,
				duration: 1, // value 1, method run every second
				dateEnd: new Date(),
				dateStart: new Date(),
				meta: [
					{
						title: currentActiveWindow.title,
						url: currentActiveWindow.platform === 'macos' ? currentActiveWindow.url : '',
						platform: currentActiveWindow.platform
					}
				]
			});
		}
	}

	retrieveAndFlushActivities(): TWindowActivities[] {
		const activities = Array.from(this.windowActivities.values());
		this.windowActivities.clear();
		return activities;
	}

	/**
	 * Dynamically imports the 'get-windows' module.
	 * This is necessary because the module may use ES6 syntax, which is incompatible with the CommonJS
	 * module system used in this project. The dynamic import allows handling both ESM and CommonJS styles.
	 * If the ESM import fails, it falls back to a CommonJS `require()` call, providing a robust solution.
	 *
	 * @returns A function that can be called to retrieve the active window information.
	 */
	async _loadGetWindows(): Promise<(options: TActiveWindowOption) => Promise<TActiveWindowResult | undefined>> {
		if (!this._getWindows) {
			const importFn = new Function('specifier', 'return import(specifier)');
			const mod = await importFn('get-windows');
			this._getWindows = mod.activeWindow;
		}
		return this._getWindows;
	}
}
