import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { IMenuItem } from '../../inteface/menu-item.interface';

@Component({
	selector: 'ga-children-menu-item',
	templateUrl: './children-menu-item.component.html',
	styleUrls: ['./children-menu-item.component.scss']
})
export class ChildrenMenuItemComponent implements OnInit {
	private _item: IMenuItem;
	private _parent: IMenuItem;
	private _selected = false;
	@Output()
	public focusItemChange: EventEmitter<any> = new EventEmitter();

	constructor(private readonly router: Router) {}

	ngOnInit(): void {
		this.checkUrl();
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

	public checkUrl() {
		if (this.router.url === this.item.link) {
			this.focusItemChange.emit({
				children: this.item,
				parent: this.parent
			});
		}
	}

	@Input()
	public set item(value: IMenuItem) {
		this._item = value;
	}

	@Input()
	public set parent(value: IMenuItem) {
		this._parent = value;
	}
	public get parent(): IMenuItem {
		return this._parent;
	}

	public get item(): IMenuItem {
		return this._item;
	}

	@Input()
	public set selected(value: boolean) {
		this._selected = value;
	}
	public get selected(): boolean {
		return this._selected;
	}
}
