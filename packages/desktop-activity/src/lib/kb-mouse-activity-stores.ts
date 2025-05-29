import { TMouseEvents, TKbMouseActivity } from './i-kb-mouse';

/**
 * Singleton class for managing keyboard and mouse activity data.
 * Tracks and provides access to user input metrics like key presses,
 * mouse clicks, and movements.
 */
export class KeyboardMouseActivityStores {
	private currentActivityData: TKbMouseActivity;
	private static instance: KeyboardMouseActivityStores;
	private constructor() {
		this.resetCurrentActivity();
	}

	/**
	 * Returns the singleton instance of KeyboardMouseActivityStores.
	 * Creates a new instance if one doesn't exist.
	 * @returns {KeyboardMouseActivityStores} The singleton instance
	 */
	static getInstance(): KeyboardMouseActivityStores {
		if (!KeyboardMouseActivityStores.instance) {
			KeyboardMouseActivityStores.instance = new KeyboardMouseActivityStores();
		}
		return KeyboardMouseActivityStores.instance;
	}

	getAndResetCurrentActivities(): TKbMouseActivity {
		const activities: TKbMouseActivity = { ...this.currentActivityData };
		this.resetCurrentActivity();
		return activities;
	}

	resetCurrentActivity() {
		this.currentActivityData = {
			kbSequence: [],
			kbPressCount: 0,
			mouseRightClickCount: 0,
			mouseLeftClickCount: 0,
			mouseMovementsCount: 0,
			mouseEvents: []
		};
	}

	updateCurrentKeyPressCount() {
		this.currentActivityData.kbPressCount += 1;
	}

	updateMouseMovementsCount() {
		this.currentActivityData.mouseMovementsCount += 1;
	}

	updateMouseLeftClick() {
		this.currentActivityData.mouseLeftClickCount += 1;
	}

	updateMouseRightClick() {
		this.currentActivityData.mouseRightClickCount += 1;
	}

	updateKbSequence(keyCode: number) {
		this.currentActivityData.kbSequence.push(keyCode);
	}

	updateMouseEvents(mouseEventMovement: TMouseEvents) {
		this.currentActivityData.mouseEvents.push(mouseEventMovement);
	}
}
