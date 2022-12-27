import { Component, OnInit, Input, forwardRef, OnDestroy, AfterViewInit } from '@angular/core';
import {
	ContactType,
	IEmployee,
	IOrganization,
	IOrganizationContact,
	PermissionsEnum
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { OrganizationContactService, Store, ToastrService } from '../../@core/services';
import { DUMMY_PROFILE_IMAGE } from '../../@core/constants';

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
export class ContactSelectorComponent implements AfterViewInit, OnInit, OnDestroy {

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

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {}

	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit() {
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
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.hasEditContact$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasPermission(PermissionsEnum.ORG_CONTACT_EDIT)
			)
		);
	}

	async getContacts() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			if (this.employeeId) {
				const items = await this.organizationContactService.getAllByEmployee(
					this.employeeId,
					{
						organizationId,
						tenantId
					}
				);
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
				...(members.length > 0 ? { members } : 0),
				imageUrl: DUMMY_PROFILE_IMAGE
			});
			this.contacts = this.contacts.concat([contact]);
			this.contactId = contact.id;
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CLIENTS.ADD_CLIENT',
				{ name }
			);
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	ngOnDestroy() {}
}
