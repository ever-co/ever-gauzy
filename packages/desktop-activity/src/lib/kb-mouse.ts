import { EventEmitter } from 'events';
import { uIOhook, UiohookKeyboardEvent, UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi';

type KeyboardMouseEvent = {
	keydown: (event: UiohookKeyboardEvent) => void;
	input: (event: UiohookKeyboardEvent) => void;
	keyup: (event: UiohookKeyboardEvent) => void;
	click: (event: UiohookMouseEvent) => void;
	wheel: (event: UiohookWheelEvent) => void;
	mouseup: (event: UiohookMouseEvent) => void;
	mousedown: (event: UiohookMouseEvent) => void;
	mousemove: (event: UiohookMouseEvent) => void;
}

type EventNames =  keyof KeyboardMouseEvent;

export default class KeyboardMouse extends EventEmitter  {
	constructor() {
		super();

		uIOhook.on('keydown', (e: UiohookKeyboardEvent) => {
			this.emit('keydown', e);
		});

		uIOhook.on('input', (e: UiohookKeyboardEvent) => {
			this.emit('input', e);
		});

		uIOhook.on('keyup', (e: UiohookKeyboardEvent) => {
			this.emit('keyup', e);
		});

		uIOhook.on('click', (e: UiohookMouseEvent) => {
			this.emit('click', e);
		});

		uIOhook.on('wheel', (e: UiohookWheelEvent) => {
			this.emit('wheel', e);
		});

		uIOhook.on('mouseup', (e: UiohookMouseEvent) => {
			this.emit('mouseup', e);
		});

		uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
			this.emit('mousedown', e);
		});
		uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
			this.emit('mousemove', e);
		});
	}

	start(): void {
		uIOhook.start();
	}

	stop(): void {
		uIOhook.stop();
	}

	override on<K extends EventNames>(event: K, listener: KeyboardMouseEvent[K]): this {
		return super.on(event, listener);
	}
}

