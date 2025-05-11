import { app } from 'electron';
import { TMouseEvents, TkbMouseActivity } from './i-kb-mouse';

export class KeyboardMouseActivityStores {
	currentActivityData: TkbMouseActivity;
	userPath: string;
	static instance: KeyboardMouseActivityStores;
	constructor() {
		this.userPath = app.getPath('userData');
		this.resetCurrentAcitivity();
	}

	static getInstance(): KeyboardMouseActivityStores {
		if (!KeyboardMouseActivityStores.instance) {
			KeyboardMouseActivityStores.instance = new KeyboardMouseActivityStores();
			return KeyboardMouseActivityStores.instance;
		}
		return KeyboardMouseActivityStores.instance;
	}

	getCurrentActivities(): TkbMouseActivity  {
		const activities: TkbMouseActivity = {...this.currentActivityData };
		this.resetCurrentAcitivity();
		return activities;
	}

	resetCurrentAcitivity() {
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
		this.currentActivityData.kbPressCount = (this.currentActivityData?.kbPressCount || 0) + 1;
	}

	updateMouseMovementsCount() {
		this.currentActivityData.mouseMovementsCount = (this.currentActivityData?.mouseMovementsCount || 0) + 1;
	}

	updateMouseLeftClick() {
		this.currentActivityData.mouseLeftClickCount = (this.currentActivityData?.mouseLeftClickCount || 0) + 1;
	}

	updateMouseRightClick() {
		this.currentActivityData.mouseRightClickCount = (this.currentActivityData?.mouseRightClickCount || 0) + 1;
	}

	updateKbSequence(keyCode: number) {
		(this.currentActivityData?.kbSequence || []).push(keyCode);
	}

	updateMouseEvents(mouseEventMovement: TMouseEvents) {
		(this.currentActivityData?.mouseEvents || []).push(mouseEventMovement);
	}
}
