import { Component, OnInit, Input, forwardRef, OnDestroy } from '@angular/core';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import {
	ContactType,
	IOrganizationContact,
	PermissionsEnum
} from '@gauzy/models';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { merge, Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../@core/services/store.service';
import { ToastrService } from '../../@core/services/toastr.service';
import { debounceTime } from 'rxjs/operators';

@UntilDestroy()
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
	hasPermissionContactEdit: boolean;
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
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasPermissionContactEdit = this.store.hasPermission(
					PermissionsEnum.ORG_CONTACT_EDIT
				);
			});

		merge(this.loadContacts$, this.store.selectedDate$)
			.pipe(untilDestroyed(this), debounceTime(300))
			.subscribe(async () => {
				if (this.store.selectedOrganization)
					if (this.employeeId) {
						const items = await this.organizationContactService.getAllByEmployee(
							this.employeeId
						);
						this.contacts = items;
					} else {
						const {
							items = []
						} = await this.organizationContactService.getAll([], {
							...(this.store.selectedOrganization.id
								? {
										organizationId: this.store
											.selectedOrganization.id
								  }
								: {})
						});
						this.contacts = items;
					}
			});

		this.loadContacts$.next();
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
		const members = [];
		if (this.employeeId) {
			members.push({ id: this.employeeId });
		}
		try {
			const contact = await this.organizationContactService.create({
				name,
				organizationId: organizationId,
				contactType: ContactType.CLIENT,
				members,
				imageUrl:
					'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text'
			});
			this.contacts = this.contacts.concat([contact]);
			this.contactId = contact.id;
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CLIENTS.ADD_CLIENT',
				null,
				{ name }
			);
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	ngOnDestroy() {}
}
