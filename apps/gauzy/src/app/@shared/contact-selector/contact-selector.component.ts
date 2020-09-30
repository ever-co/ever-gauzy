import { Component, OnInit, Input, forwardRef, OnDestroy } from '@angular/core';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { ContactType, IOrganizationContact } from '@gauzy/models';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Store } from '../../@core/services/store.service';
import { ToastrService } from '../../@core/services/toastr.service';

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
	contacts: IOrganizationContact[] = [];

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
		private organizationContactService: OrganizationContactService,
		private store: Store,
		private toastrService: ToastrService
	) {}

	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit() {
		this.loadContacts$.pipe(untilDestroyed(this)).subscribe(async () => {
			const organizationId = this.store.selectedOrganization.id;
			if (this.employeeId) {
				const items = await this.organizationContactService.getAllByEmployee(
					this.employeeId
				);
				this.contacts = items;
			} else {
				const {
					items = []
				} = await this.organizationContactService.getAll([], {
					organizationId
				});
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

	createNew = async (name: string) => {
		const organizationId = this.store.selectedOrganization.id;
		try {
			const contact = await this.organizationContactService.create({
				name,
				organizationId: organizationId,
				contactType: ContactType.CLIENT,
				imageUrl:
					'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text'
			});
			this.contacts.push(contact);
			this.contactId = contact.id;
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				null,
				{ name }
			);
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	ngOnDestroy() {}
}
