import { Component, OnInit, Input, forwardRef } from '@angular/core';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { OrganizationContact } from '@gauzy/models';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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
export class ContactSelectorComponent implements OnInit {
	private _contactId: string | string[];
	contacts: OrganizationContact[];

	@Input() disabled = false;
	@Input() multiple = false;

	onChange: any = () => {};
	onTouched: any = () => {};

	constructor(
		private organizationContactService: OrganizationContactService
	) {}

	set contactId(val: string | string[]) {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		this._contactId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get contactId(): string | string[] {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		return this._contactId;
	}

	ngOnInit() {
		this.loadContacts();
	}

	private async loadContacts(): Promise<void> {
		const { items = [] } = await this.organizationContactService.getAll([]);
		this.contacts = items;
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
