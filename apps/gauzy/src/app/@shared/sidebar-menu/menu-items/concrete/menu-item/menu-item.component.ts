import { Location } from '@angular/common';
import {
	AfterViewChecked,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	Input,
	OnInit,
	Output,
} from '@angular/core';
import { Router } from '@angular/router';
import { NbSidebarService } from '@nebular/theme';
import JitsuAnalyticsEvents from 'apps/gauzy/src/app/@core/services/analytics/event.type';
import { JitsuService } from 'apps/gauzy/src/app/@core/services/analytics/jitsu.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { IUser } from 'packages/contracts/dist';
import { tap } from 'rxjs/operators';
import { IMenuItem } from '../../interface/menu-item.interface';

@Component({
	selector: 'ga-menu-item',
	templateUrl: './menu-item.component.html',
	styleUrls: ['./menu-item.component.scss'],
})
export class MenuItemComponent implements OnInit, AfterViewChecked {
	private _state: boolean;
	private _item: IMenuItem;
	private _collapse = true;
	private _selectedChildren: IMenuItem;
	private _selected: boolean;
	private _user: IUser;

	@Output()
	public collapsedChange: EventEmitter<any> = new EventEmitter();
	@Output()
	public selectedChange: EventEmitter<any> = new EventEmitter();

	constructor(
		private router: Router,
		private sidebarService: NbSidebarService,
		private cdr: ChangeDetectorRef,
		private location: Location,
		private jitsuService: JitsuService,
		private readonly store: Store
	) {}

	ngOnInit(): void {
		this._user = this.store.user;
		if (this.item.home) this.selectedChange.emit(this.item);
	}

	public onCollapse(event: boolean) {
		this.collapse = event;
	}

	public focusOn(event: any) {
		this.selectedChildren = event.children;
		if (this.collapse) this.collapse = !this.collapse;
		this.selectedChange.emit(event.parent);
		this.cdr.detectChanges();
	}

	public jitsuTrackClick() {
		const clickEvent: JitsuAnalyticsEvents = {
			eventType: 'ButtonClicked',
			url: this.item.url ?? this.item.link,
			userId: this._user.id,
			userEmail: this._user.email,
			menuItemName: this.item.title,
		};
		this.jitsuService.trackEvents(clickEvent.eventType, clickEvent);
		this.jitsuService.identify(this._user.id, {
			email: this._user.email,
			fullName: this._user.name,
			timeZone: this._user.timeZone,
		});
		this.jitsuService.group(this._user.id, {
			email: this._user.email,
			fullName: this._user.name,
			timeZone: this._user.timeZone,
		});
	}

	public redirectTo() {
		this.jitsuTrackClick();
		if (!this.item.children) this.router.navigateByUrl(this.item.link);
		if (this.item.home) this.router.navigateByUrl(this.item.url);
		this.selectedChange.emit(this.item);
		this.cdr.detectChanges();
	}

	public toggleSidebar() {
		if (!this.state && !this.item.home)
			this.sidebarService.toggle(false, 'menu-sidebar');
		this.redirectTo();
	}

	public getExternalUrl(url: string): string {
		return url ? this.location.prepareExternalUrl(url) : url;
	}

	ngAfterViewChecked(): void {
		this.sidebarService
			.getSidebarState('menu-sidebar')
			.pipe(
				tap(
					(state) =>
						(this.state = state === 'expanded' ? true : false)
				)
			)
			.subscribe();
		this.cdr.detectChanges();
	}

	@Input()
	public set collapse(value) {
		this._collapse = value;
	}

	@Input()
	public set item(value: IMenuItem) {
		this._item = value;
	}

	@Input()
	public set selected(value: boolean) {
		this._selected = value;
	}

	public set state(value) {
		this._state = value;
	}

	public set selectedChildren(value: IMenuItem) {
		this._selectedChildren = value;
	}

	public get collapse() {
		return this._collapse;
	}

	public get item() {
		return this._item;
	}

	public get state() {
		return this._state;
	}

	public get selectedChildren() {
		return this._selectedChildren;
	}

	public get selected() {
		return this._selected;
	}
}
