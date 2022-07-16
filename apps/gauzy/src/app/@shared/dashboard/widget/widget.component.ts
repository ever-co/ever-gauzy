import { Component, Input, OnInit, TemplateRef } from '@angular/core';
import { Collapsable } from '../interfaces/collapsable.interface';
import { Draggable } from '../interfaces/draggable.interface';
import { Expandable } from '../interfaces/expandable.interface';

@Component({
	selector: 'ga-widget',
	templateUrl: './widget.component.html',
	styleUrls: ['./widget.component.scss']
})
export class WidgetComponent
	implements OnInit, Draggable, Expandable, Collapsable
{
	private _templateRef: TemplateRef<HTMLElement>;
	private _position: number;
	private _title: string;
	private _collapsed: boolean = false;
	hide: boolean = false;

	constructor() {}

	ngOnInit(): void {}

	@Input()
	set templateRef(value: TemplateRef<HTMLElement>) {
		this._templateRef = value;
	}
	get templateRef(): TemplateRef<HTMLElement> {
		return this._templateRef;
	}
	set title(value: string) {
		this._title = value;
	}
	get title(): string {
		return this._title;
	}
	get position(): number {
		return this._position;
	}
	set position(value: number) {
		this._position = value;
	}
	get isExpand(): boolean {
		return !this._collapsed;
	}
	set isExpand(value: boolean) {
		this._collapsed = !value;
	}
	get isCollapse(): boolean {
		return this._collapsed;
	}
	set isCollapse(value: boolean) {
		this._collapsed = value;
	}
}
