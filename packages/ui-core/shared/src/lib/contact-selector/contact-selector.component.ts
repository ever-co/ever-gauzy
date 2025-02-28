import { Component, OnInit, Input, forwardRef, AfterViewInit } from '@angular/core';
import { ContactType, IEmployee, IOrganization, IOrganizationContact, PermissionsEnum } from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { OrganizationContactService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact-selector',
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
export class ContactSelectorComponent implements AfterViewInit, OnInit {
	public organization: IOrganization;
	contacts: IOrganizationContact[] = [];

	@Input() disabled = false;
	@Input() multiple = false;

	private _employeeId: IEmployee['id'];
	public get employeeId(): IEmployee['id'] {
		return this._employeeId;
	}
	@Input() public set employeeId(value: IEmployee['id']) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	private _contactId: string | string[];
	public get contactId(): string | string[] {
		return this._contactId;
	}
	@Input() public set contactId(val: string | string[]) {
		this._contactId = val;
		this.onChange(val);
		this.onTouched(val);
	}

	subject$: Subject<boolean> = new Subject();
	public hasEditContact$: Observable<boolean>;

	onChange: any = () => {};
	onTouched: any = () => {};

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {}

	ngOnInit(): void {
		this.hasEditContact$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermission(PermissionsEnum.ORG_CONTACT_EDIT))
		);
	}

	ngAfterViewInit(): void {
		this.subject$
			.pipe(
				tap(() => this.getContacts()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getContacts() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			if (this.employeeId) {
				const items = await this.organizationContactService.getAllByEmployee(this.employeeId, {
					organizationId,
					tenantId
				});
				this.contacts = items;
			} else {
				const { items = [] } = await this.organizationContactService.getAll([], {
					organizationId,
					tenantId
				});
				this.contacts = items;
			}
		} catch (error) {
			console.log('Error while retrieving organization contacts', error);
		}
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

	createNew = async (name: IOrganizationContact['name']) => {
		if (!this.organization || !name) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const members = [];
		if (this.employeeId) {
			members.push({ id: this.employeeId });
		}
		try {
			const contact = await this.organizationContactService.create({
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT,
				...(isNotEmpty(members) ? { members } : {})
			});
			if (contact) {
				this.contacts = this.contacts.concat([contact]);
				this.contactId = contact.id;

				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CLIENTS.ADD_CLIENT', {
					name
				});
			}
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	markAsTouchedOnInteraction(): void {
		this.onTouched();
	}
}
