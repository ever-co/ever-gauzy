import { Location } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IMenuItem } from '../../interface/menu-item.interface';

@Component({
	selector: 'ga-children-menu-item',
	templateUrl: './children-menu-item.component.html',
	styleUrls: ['./children-menu-item.component.scss']
})
export class ChildrenMenuItemComponent implements OnInit {
	private _item: IMenuItem;
	private _parent: IMenuItem;
	private _selected = false;
	private _collapse: boolean;
	private _mouseHover: boolean;

	@Output() public focusItemChange: EventEmitter<any> = new EventEmitter();

	constructor(
		private readonly router: Router,
		private readonly location: Location
	) {}

	ngOnInit(): void {
		this.checkUrl(this.router.url);
		this.router.events.subscribe((val) => {
			if ((val as NavigationEnd).url) {
				this.checkUrl((val as NavigationEnd).url);
			}
		});
	}

	public redirectTo(): void {
		this.router.navigateByUrl(this.item.link);
	}

	public select(): void {
		this.focusItemChange.emit({
			children: this.item,
			parent: this.parent
		});
		this.redirectTo();
	}

	public checkUrl(url: string) {
		if (url === this.item.link) {
			this.focusItemChange.emit({
				children: this.item,
				parent: this.parent
			});
		}
	}

	public adpatExternalUrl(url: string): string {
		return url ? this.location.prepareExternalUrl(url) : url;
	}

	public add() {
		this.focusItemChange.emit({
			children: this.item,
			parent: this.parent
		});
		this.router.navigateByUrl(this.item.data.add);
	}

	public isLast(): boolean {
		const last = this.parent.children.slice(-1)[0];
		return this.item === last;
	}

	public get item(): IMenuItem {
		return this._item;
	}
	@Input()
	public set item(value: IMenuItem) {
		this._item = value;
	}

	public get parent(): IMenuItem {
		return this._parent;
	}
	@Input()
	public set parent(value: IMenuItem) {
		this._parent = value;
	}

	public get collapse() {
		return this._collapse;
	}
	@Input()
	public set collapse(value: boolean) {
		this._collapse = value;
	}

	public get selected(): boolean {
		return this._selected;
	}
	@Input()
	public set selected(value: boolean) {
		this._selected = value;
	}

	public set mouseHover(value: boolean) {
		this._mouseHover = value;
	}
	public get mouseHover() {
		return this._mouseHover;
	}
}
