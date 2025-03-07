import { Component, OnInit, OnDestroy, Input, forwardRef, EventEmitter, Output } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { map, Observable, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ContactType, IOrganization, IOrganizationContact, PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { OrganizationContactService, ErrorHandlingService, ToastrService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact-select',
	templateUrl: './contact-select.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ContactSelectComponent),
			multi: true
		}
	]
})
export class ContactSelectComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public hasEditEmployee$: Observable<boolean>;
	contacts: IOrganizationContact[] = [];
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	_disabled = false;
	get disabled(): boolean {
		return this._disabled;
	}
	@Input() set disabled(value: boolean) {
		this._disabled = value;
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	_placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for dynamic clearable option
	 */
	_clearable: boolean;
	get clearable(): boolean {
		return this._clearable;
	}
	@Input() set clearable(value: boolean) {
		this._clearable = value;
	}

	/*
	 * Getter & Setter for dynamic add tag option
	 */
	_addTag = false;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	/*
	 * Getter & Setter for dynamic searchable option
	 */
	_searchable = true;
	get searchable(): boolean {
		return this._searchable;
	}
	@Input() set searchable(value: boolean) {
		this._searchable = value;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	private _organizationContact: IOrganizationContact;
	set organizationContact(val: IOrganizationContact) {
		this._organizationContact = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get organizationContact(): IOrganizationContact {
		return this._organizationContact;
	}

	@Output() onChanged = new EventEmitter<IOrganizationContact>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly organizationContactService: OrganizationContactService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.getContacts()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.hasEditEmployee$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT))
		);
	}

	async getContacts() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.organizationContactService.getAll([], {
			organizationId,
			tenantId
		});
		this.contacts = items;
	}

	writeValue(value: IOrganizationContact) {
		if (value) {
			this._organizationContact = value;
			this.onChange(value);
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

	selectContact(contact: IOrganizationContact): void {
		this.organizationContact = contact;
		this.onChange(contact);
		this.onChanged.emit(contact);
	}

	searchContact(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	/**
	 * Adds a new organization contact with the specified name.
	 *
	 * @param name The name of the contact to add.
	 * @returns A promise that resolves to the created organization contact object.
	 */
	addOrganizationContact = async (name: string): Promise<IOrganizationContact | null> => {
		if (!this.organization) {
			return null;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		try {
			const contact = await this.organizationContactService.create({
				name,
				contactType: ContactType.CLIENT,
				organizationId,
				organization: { id: organizationId },
				tenantId,
				tenant: { id: tenantId }
			});

			this.toastrService.success(
				this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT', { name }),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			return contact;
		} catch (error) {
			this.errorHandler.handleError(error);
			// Optionally, re-throw or return null to indicate failure
			return null;
		}
	};

	markAsTouchedOnInteraction(): void {
		this.onTouched();
	}

	ngOnDestroy() {}
}
