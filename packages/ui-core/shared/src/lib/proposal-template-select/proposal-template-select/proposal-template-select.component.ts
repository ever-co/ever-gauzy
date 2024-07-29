import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IEmployeeProposalTemplate, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange, Store } from '@gauzy/ui-core/common';
import { ErrorHandlingService, ProposalTemplateService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ngx-proposal-template-select',
	templateUrl: './proposal-template-select.component.html',
	styleUrls: ['./proposal-template-select.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ProposalTemplateSelectComponent),
			multi: true
		}
	]
})
export class ProposalTemplateSelectComponent implements OnInit {
	proposalTemplates: IEmployeeProposalTemplate[] = [];
	organization: IOrganization;
	subject$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};

	@Input() disabled = false;
	@Input() multiple = false;

	/*
	 * Getter & Setter for employeeId
	 */
	private _employeeId: ID;
	public get employeeId(): ID {
		return this._employeeId;
	}
	@Input() public set employeeId(value: ID) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	/**
	 * Proposal template id
	 */
	private _proposalTemplateId: string | string[];
	set proposalTemplateId(val: string | string[]) {
		this._proposalTemplateId = val;
		// Emit selected proposal template
		this.onChange(val);
		this.onTouched(val);
	}
	get proposalTemplateId(): string | string[] {
		return this._proposalTemplateId;
	}

	@Output() selectedChange: EventEmitter<IEmployeeProposalTemplate | null> = new EventEmitter();

	constructor(
		private readonly _proposalTemplateService: ProposalTemplateService,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getProposalTemplates()),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Write value
	 * @param value - The value to be written, can be a string or an array of strings
	 */
	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._proposalTemplateId = value instanceof Array ? value : [value];
		} else {
			this._proposalTemplateId = value;
		}
	}

	/**
	 * On selected change
	 * @param selectedItem - The ID of the selected item
	 */
	onSelectedChange(selectedItem: ID) {
		const proposalTemplate = this.proposalTemplates.find(
			({ id }: IEmployeeProposalTemplate) => id === selectedItem
		);
		this.selectedChange.emit(proposalTemplate || null);
	}

	/**
	 * Register on change
	 * @param fn - A function that takes a number (rating) as an argument and returns void
	 */
	registerOnChange(fn: (rating: number) => void) {
		this.onChange = fn;
	}

	/**
	 * Register on touched
	 * @param fn - A function that takes no arguments and returns void
	 */
	registerOnTouched(fn: () => void) {
		this.onTouched = fn;
	}

	/**
	 * Set disabled state
	 * @param isDisabled - A boolean indicating whether the control should be disabled
	 */
	setDisabledState(isDisabled: boolean) {
		this.disabled = isDisabled;
	}

	/**
	 * Get proposal templates
	 */
	async getProposalTemplates() {
		try {
			const { id: organizationId, tenantId } = this.organization;
			const { employeeId } = this;

			const { items = [] } = await this._proposalTemplateService.getAll({
				where: {
					organizationId,
					tenantId,
					...(employeeId ? { employeeId } : {})
				}
			});
			this.proposalTemplates = items;
			this.defaultSelectedTemplate();
		} catch (error) {
			console.log('Error while getting proposal templates', error);
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Set default selected proposal template
	 */
	defaultSelectedTemplate() {
		// Find default proposal template
		const proposalTemplate = this.proposalTemplates.find(
			({ isDefault }: IEmployeeProposalTemplate) => isDefault === true
		);
		this.proposalTemplateId = proposalTemplate?.id || null;

		// Emit selected proposal template
		this.onSelectedChange(this.proposalTemplateId);
	}
}
