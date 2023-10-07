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
import { tap } from 'rxjs/operators';
import { NbSidebarService } from '@nebular/theme';
import { IUser } from '@gauzy/contracts';
import JitsuAnalyticsEvents, {
	JitsuAnalyticsEventsEnum,
} from './../../../../../@core/services/analytics/event.type';
import { JitsuService } from './../../../../../@core/services/analytics/jitsu.service';
import { Store } from './../../../../../@core/services/store.service';
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

	@Output() public collapsedChange: EventEmitter<any> = new EventEmitter();
	@Output() public selectedChange: EventEmitter<any> = new EventEmitter();

	constructor(
		private readonly router: Router,
		private readonly sidebarService: NbSidebarService,
		private readonly cdr: ChangeDetectorRef,
		private readonly location: Location,
		private readonly jitsuService: JitsuService,
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

	/**
	 * Track a click event.
	 * @param item The item that was clicked.
	 * @param user The user who clicked the item.
	 */
	public async jitsuTrackClick() {
		const clickEvent: JitsuAnalyticsEvents = {
			eventType: JitsuAnalyticsEventsEnum.BUTTON_CLICKED,
			url: this.item.url ?? this.item.link,
			userId: this._user.id,
			userEmail: this._user.email,
			menuItemName: this.item.title,
		};

		// Identify the user
		await this.jitsuService.identify(this._user.id, {
			email: this._user.email,
			fullName: this._user.name,
			timeZone: this._user.timeZone,
		});

		// Group the user
		await this.jitsuService.group(this._user.id, {
			email: this._user.email,
			fullName: this._user.name,
			timeZone: this._user.timeZone,
		});

		// Track the click event
		await this.jitsuService.trackEvents(clickEvent.eventType, clickEvent);
	}

	public redirectTo() {
		// We don't await here because we don't want to wait for the analytics to complete before redirecting
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
