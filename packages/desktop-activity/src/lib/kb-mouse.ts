import { EventEmitter } from 'node:events';
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
	private handleKeydown: (event: UiohookKeyboardEvent) => void;
	private handleInput: (event: UiohookKeyboardEvent) => void;
	private handleKeyup: (event: UiohookKeyboardEvent) => void;
	private handleClick: (event: UiohookMouseEvent) => void;
	private handleWheel: (event: UiohookWheelEvent) => void;
	private handleMouseup: (event: UiohookMouseEvent) => void;
	private handleMousedown: (event: UiohookMouseEvent) => void;
	private handleMousemove: (event: UiohookMouseEvent) => void;
	constructor() {
		super();
		this.handleKeydown = (event: UiohookKeyboardEvent) => this.emit('keydown', event);
		this.handleInput = (event: UiohookKeyboardEvent) => this.emit('input', event);
		this.handleKeyup = (event: UiohookKeyboardEvent) => this.emit('keyup', event);
		this.handleClick = (event: UiohookMouseEvent) => this.emit('click', event);
		this.handleWheel = (event: UiohookWheelEvent) => this.emit('wheel', event);
		this.handleMouseup = (event: UiohookMouseEvent) => this.emit('mouseup', event);
		this.handleMousedown = (event: UiohookMouseEvent) => this.emit('mousedown', event);
		this.handleMousemove = (event: UiohookMouseEvent) => this.emit('mousemove', event);

		uIOhook.on('keydown', this.handleKeydown);
		uIOhook.on('input', this.handleInput);
		uIOhook.on('keyup', this.handleKeyup);
		uIOhook.on('click', this.handleClick);
		uIOhook.on('wheel', this.handleWheel);
		uIOhook.on('mouseup', this.handleMouseup);
		uIOhook.on('mousedown', this.handleMousedown);
		uIOhook.on('mousemove', this.handleMousemove);
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

