import { uIOhook, UiohookKey, UiohookKeyboardEvent, UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi'

export class KeyboardMouseCounter {
	static instance: KeyboardMouseCounter;
	private isStarted: boolean;
	constructor() {
		if (!KeyboardMouseCounter.instance) {
			KeyboardMouseCounter.instance = this;
		}
	}

	static getInstance(): KeyboardMouseCounter {
		if (!KeyboardMouseCounter.instance) {
			KeyboardMouseCounter.instance = new KeyboardMouseCounter();
			return KeyboardMouseCounter.instance;
		}
		return KeyboardMouseCounter.instance;
	}

	registerEvent() {
		uIOhook.on('keydown', (e: UiohookKeyboardEvent) => {
			console.log('keyboard pressed at key', e.keycode);
		});

		uIOhook.on('click', (e: UiohookMouseEvent) => {
			console.log('mouse click at position', `${e.x}, ${e.y}`);
		});

		uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
			console.log('mouse moved at position', `${e.x}. ${e.y}`)
		});

		uIOhook.on('wheel', (e: UiohookWheelEvent) => {
			console.log('mouse wheeled at position', `${e.direction} to ${e.x}, ${e.y}`);
		});
	}

	startListener() {
		if (!this.isStarted) {
			this.registerEvent();
			uIOhook.start();
			this.isStarted = true;
		}
	}

	stopListener() {
		if (this.isStarted) {
			uIOhook.stop();
			this.isStarted = false;
		}
	}
}
