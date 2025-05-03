import KeyboardMouse from './kb-mouse';
import KeyboardMouseActivityStores from './kb-mouse-activity-stores';

export class KeyboardMouseEventCounter {
	private isStarted: boolean;
	private keyboardMouse: KeyboardMouse;
	private keyboardMouseActivityStores = new KeyboardMouseActivityStores();
	private timeSecond: number = 0;
	private timeInterval: ReturnType<typeof setInterval>;
	private timeSlotBuffer: number;
	private activityBuffer: number = 10;
	private currentTimeActivity: number = 0;
	private currentTimeSlot: number = 0;
	constructor() {
		this.isStarted = false;
		this.keyboardMouse = new KeyboardMouse();
	}

	registerEvent() {
		this.keyboardMouse.on('keydown', (e) => {
			try {
				this.keyboardMouseActivityStores.updateKbSequence(e.keycode);
				this.keyboardMouseActivityStores.updateCurrentKeyPressCount();
			} catch (error) {
				console.log('error', error);
			}
		});

		this.keyboardMouse.on('click', (e) => {
			if (e.button === 1) {
				this.keyboardMouseActivityStores.updateMouseLeftClick();
			}

			if (e.button === 2) {
				this.keyboardMouseActivityStores.updateMouseRightClick();
			}
		});

		this.keyboardMouse.on('mousemove', (e) => {
			// console.log('mouse moved at position', `${e.x}, ${e.y}`)
			this.keyboardMouseActivityStores.updateMouseMovementsCount();
			console.log('movement', e);
		});

		this.keyboardMouse.on('wheel', (e) => {
			// console.log('mouse wheeled at position', `${e.direction} to ${e.x}, ${e.y}`);
		});
	}

	timeActivity() {
		// buffer activity write
		if (this.activityBuffer === this.currentTimeActivity) {
			this.endBufferActivity();
		}
	}

	endBufferActivity() {
		this.currentTimeActivity = 0;
		this.keyboardMouseActivityStores.writeData();
	}

	startTimer() {
		clearInterval(this.timeInterval);
		this.timeInterval = setInterval(() => {
			this.timeSecond += 1;
			this.currentTimeSlot += 1;
			this.currentTimeActivity += 1;
			this.timeActivity();
		}, 1000);
	}

	endTimer() {
		clearInterval(this.timeInterval);
		this.timeSecond = 0;
	}

	startListener() {
		if (!this.isStarted) {
			this.registerEvent();
			this.keyboardMouse.start();
			this.isStarted = true;
			this.startTimer();
		}
	}

	stopListener() {
		if (this.isStarted) {
			this.keyboardMouse.stop();
			this.keyboardMouse.removeAllListeners();
			this.isStarted = false;
			this.endTimer();
		}
	}
}
