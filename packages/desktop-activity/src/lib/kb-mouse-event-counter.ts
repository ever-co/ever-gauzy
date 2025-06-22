import KeyboardMouse from './kb-mouse';
import { KeyboardMouseActivityStores } from './kb-mouse-activity-stores';
import { UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi';
import { debounce } from 'underscore';
import { KbMouseTimer } from './kb-mouse-timer';

type TMousePosition = {
	x: number;
	y: number;
};

export class KeyboardMouseEventCounter {
	private isStarted: boolean;
	private keyboardMouse: KeyboardMouse;
	private keyboardMouseActivityStores: KeyboardMouseActivityStores;
	private currentMousePosition: TMousePosition = { x: 0, y: 0 };
	private startMousePosition: TMousePosition = { x: 0, y: 0 };
	private readonly mouseMoveThreshold: number = 10;
	private mouseIsMove: boolean;
	private debounceMovement: () => void;
	private static instance: KeyboardMouseEventCounter;
	private kbMouseTimer: KbMouseTimer;
	private resetAfkTimer: () => void;
	private isKbMouseTrackedCallback: (isActive?: boolean) => void;
	private constructor() {
		this.isStarted = false;
		this.keyboardMouse = new KeyboardMouse();
		this.debounceMovement = debounce(this.mouseMeasureMovement.bind(this), 300);
		this.keyboardMouseActivityStores = KeyboardMouseActivityStores.getInstance();
		this.kbMouseTimer = KbMouseTimer.getInstance();
		this.resetAfkTimer = debounce(this.sendEvent.bind(this), 100);
	}

	static getInstance(): KeyboardMouseEventCounter {
		if (!KeyboardMouseEventCounter.instance) {
			KeyboardMouseEventCounter.instance = new KeyboardMouseEventCounter();
		}
		return KeyboardMouseEventCounter.instance;
	}

	/** Reset AFK timer – debounced from user input events. */
	private sendEvent() {
		this.kbMouseTimer.resetAfkTimer();
	}

	registerEvent() {
		this.keyboardMouse.on('keydown', (e) => {
			try {
				this.resetAfkTimer();
				this.keyboardMouseActivityStores.updateKbSequence(e.keycode);
				this.keyboardMouseActivityStores.updateCurrentKeyPressCount();
			} catch (error) {
				console.error('Error handling keyboard event:', error);
			}
		});

		this.keyboardMouse.on('click', (e) => {
			this.resetAfkTimer();
			if (e.button === 0) {
				this.keyboardMouseActivityStores.updateMouseLeftClick();
			}
			if (e.button === 2) {
				this.keyboardMouseActivityStores.updateMouseRightClick();
			}
		});

		this.keyboardMouse.on('mousemove', (e) => {
			this.resetAfkTimer();
			this.mouseMoveEventHandler(e);
		});

		this.keyboardMouse.on('wheel', (e) => {
			this.resetAfkTimer();
			this.mouseMoveEventHandler(e);
		});
	}

	mouseMeasureMovement() {
		if (this.startMousePosition) {
			const yPositionMovement = Math.abs(this.startMousePosition.y - this.currentMousePosition.y);
			const xPositionMovement = Math.abs(this.startMousePosition.x - this.currentMousePosition.x);
			if (yPositionMovement >= this.mouseMoveThreshold || xPositionMovement >= this.mouseMoveThreshold) {
				this.keyboardMouseActivityStores.updateMouseMovementsCount();
				this.keyboardMouseActivityStores.updateMouseEvents({
					moveTo: {
						from: this.startMousePosition,
						to: this.currentMousePosition
					}
				});
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
			};
		}
		this.currentMousePosition = {
			x: e.x,
			y: e.y
		};
		this.debounceMovement();
	}

	startListener() {
		if (!this.isStarted) {
			this.registerEvent();
			this.keyboardMouse.start();
			this.isStarted = true;
			this.isKbMouseTrackedCallback?.(this.isStarted);
		}
	}

	stopListener() {
		if (this.isStarted) {
			this.keyboardMouse.stop();
			this.keyboardMouse.removeAllListeners();
			this.isStarted = false;
			this.isKbMouseTrackedCallback?.(this.isStarted);
		}
	}

	setKeyboardMouseStatusCallback(callback: (isActive?: boolean) => void) {
		this.isKbMouseTrackedCallback = callback;
	}
}
