import { Component, OnInit, Input, forwardRef, OnDestroy } from '@angular/core';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { OrganizationContact } from '@gauzy/models';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Component({
	selector: 'gauzy-contact-selector',
	templateUrl: './contact-selector.component.html',
	styleUrls: ['./contact-selector.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ContactSelectorComponent),
			multi: true
		}
	]
})
export class ContactSelectorComponent implements OnInit, OnDestroy {
	private _contactId: string | string[];
	private _employeeId: string;
	contacts: OrganizationContact[];

	@Input() disabled = false;
	@Input() multiple = false;
	@Input()
	public get employeeId() {
		return this._employeeId;
	}
	public set employeeId(value) {
		this._employeeId = value;
		this.loadContacts$.next();
	}

	set contactId(val: string | string[]) {
		this._contactId = val;
		this.onChange(val);
		this.onTouched(val);
		this.loadContacts$.next();
	}
	get contactId(): string | string[] {
		return this._contactId;
	}

	loadContacts$: Subject<any> = new Subject();

	constructor(
		private organizationContactService: OrganizationContactService
	) {}

	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit() {
		this.loadContacts$.pipe(untilDestroyed(this)).subscribe(async () => {
			if (this.employeeId) {
				this.contacts = await this.organizationContactService.getAllByEmployee(
					this.employeeId
				);
			} else {
				const {
					items = []
				} = await this.organizationContactService.getAll([]);
				this.contacts = items;
			}
		});
	}

	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._contactId = value instanceof Array ? value : [value];
		} else {
			this._contactId = value;
		}
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}
	ngOnDestroy() {}
}
