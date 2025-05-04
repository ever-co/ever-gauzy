import KeyboardMouse from './kb-mouse';
import KeyboardMouseActivityStores from './kb-mouse-activity-stores';
import { UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi';
import { debounce } from 'underscore';

type TMousePosition = {
	x: number,
	y: number
}

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
	private currentMousePosition: TMousePosition;
	private startMousePosition: TMousePosition;
	private readonly mouseMoveThreshold: number = 10;
	private mouseIsMove: boolean;
	private debounceMovement: () => void;
	constructor() {
		this.isStarted = false;
		this.keyboardMouse = new KeyboardMouse();
		this.debounceMovement = debounce(this.mouseMeasureMovement.bind(this), 300);
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
			this.mouseMoveEventHandler(e);
		});

		this.keyboardMouse.on('wheel', (e) => {
			// console.log('mouse wheeled at position', `${e.direction} to ${e.x}, ${e.y}`);
			this.mouseMoveEventHandler(e);
		});
	}

	mouseMeasureMovement() {
		if (this.startMousePosition) {
			const yPositionMovement = Math.abs(this.startMousePosition.y - this.currentMousePosition.y);
			const xPositionMovement = Math.abs(this.startMousePosition.x - this.currentMousePosition.x);
			if (yPositionMovement >= this.mouseMoveThreshold && xPositionMovement >= this.mouseMoveThreshold) {
				this.keyboardMouseActivityStores.updateMouseMovementsCount();
				this.keyboardMouseActivityStores.updateMouseEvents({
					moveTo: {
						from: this.startMousePosition,
						to: this.currentMousePosition
					}
				})
			}
		}
		this.mouseIsMove = false;
	}
	mouseMoveEventHandler(e: UiohookMouseEvent | UiohookWheelEvent) {
		if (!this.mouseIsMove) {
			this.mouseIsMove = true;
			this.startMousePosition = {
				x: e.x,
				y: e.y
			}
		}
		this.currentMousePosition = {
			x: e.x,
			y: e.y
		}
		this.debounceMovement();
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
