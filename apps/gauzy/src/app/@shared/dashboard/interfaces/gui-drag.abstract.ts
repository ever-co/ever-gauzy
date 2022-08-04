import { Component, Input, TemplateRef } from '@angular/core';
import { Collapsable } from './collapsable.interface';
import { Draggable } from './draggable.interface';
import { Expandable } from './expandable.interface';

@Component({ template: '' })
export abstract class GuiDrag implements Draggable, Expandable, Collapsable {
	private _templateRef: TemplateRef<HTMLElement>;
	private _position: number;
	private _title: string;
	private _collapsed: boolean = false;
	private _move: boolean = false;
	private _hide: boolean = false;
	private _positions: number[] = [];

	constructor() {}

	public onClickSetting(event: boolean) {}
	@Input()
	public set templateRef(value: TemplateRef<HTMLElement>) {
		this._templateRef = value;
	}

	public get templateRef(): TemplateRef<HTMLElement> {
		return this._templateRef;
	}
	public set title(value: string) {
		this._title = value;
	}
	public get title(): string {
		return this._title;
	}
	public get position(): number {
		return this._position;
	}
	@Input()
	public set position(value: number) {
		if (this._positions.length === 0) this._positions.push(value);
		this._position = this._positions[0];
	}
	public get isExpand(): boolean {
		return !this._collapsed;
	}
	@Input()
	public set isExpand(value: boolean) {
		this._collapsed = !value;
	}
	public get isCollapse(): boolean {
		return this._collapsed;
	}
	@Input()
	public set isCollapse(value: boolean) {
		this._collapsed = value;
	}
	public get move(): boolean {
		return this._move;
	}
	public set move(value: boolean) {
		this._move = value;
	}
	public get hide(): boolean {
		return this._hide;
	}
	public set hide(value: boolean) {
		this._hide = value;
	}
	public toObject(): Partial<GuiDrag> {
		return {
			position: this.position,
			isCollapse: this.isCollapse,
			isExpand: this.isExpand,
			hide: this.hide,
			title: this.title
		};
	}
}
