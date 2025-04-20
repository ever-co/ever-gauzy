import KeyboardMouse from './kb-mouse';
const keyboardMouse = new KeyboardMouse();
export class KeyboardMouseEventCounter {
	private isStarted: boolean;

	constructor() {
		this.isStarted = false;
	}

	registerEvent() {
		keyboardMouse.on('keydown', (e) => {
			console.log('keyboard pressed at key', e.keycode);
		});

		keyboardMouse.on('click', (e) => {
			console.log('mouse click at position', `${e.x}, ${e.y}`);
		});

		keyboardMouse.on('mousemove', (e) => {
			console.log('mouse moved at position', `${e.x}. ${e.y}`)
		});

		keyboardMouse.on('wheel', (e) => {
			console.log('mouse wheeled at position', `${e.direction} to ${e.x}, ${e.y}`);
		});
	}

	startListener() {
		if (!this.isStarted) {
			this.registerEvent();
			keyboardMouse.start();
			this.isStarted = true;
		}
	}

	stopListener() {
		if (this.isStarted) {
			keyboardMouse.stop();
			this.isStarted = false;
		}
	}
}
