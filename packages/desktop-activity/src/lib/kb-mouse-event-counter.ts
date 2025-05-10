import KeyboardMouse from './kb-mouse';
export class KeyboardMouseEventCounter {
	private isStarted: boolean;
	private keyboardMouse: KeyboardMouse;
	constructor() {
		this.isStarted = false;
		this.keyboardMouse = new KeyboardMouse();
	}

	registerEvent() {
		this.keyboardMouse.on('keydown', (e) => {
			console.log('keyboard pressed at key', e.keycode);
		});

		this.keyboardMouse.on('click', (e) => {
			console.log('mouse click at position', `${e.x}, ${e.y}`);
		});

		this.keyboardMouse.on('mousemove', (e) => {
			console.log('mouse moved at position', `${e.x}, ${e.y}`)
		});

		this.keyboardMouse.on('wheel', (e) => {
			console.log('mouse wheeled at position', `${e.direction} to ${e.x}, ${e.y}`);
		});
	}

	startListener() {
		if (!this.isStarted) {
			this.registerEvent();
			this.keyboardMouse.start();
			this.isStarted = true;
		}
	}

	stopListener() {
		if (this.isStarted) {
			this.keyboardMouse.stop();
			this.keyboardMouse.removeAllListeners();
			this.isStarted = false;
		}
	}
}
