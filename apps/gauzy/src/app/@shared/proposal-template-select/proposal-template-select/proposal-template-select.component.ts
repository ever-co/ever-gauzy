import {
	Component,
	EventEmitter,
	forwardRef,
	Input,
	OnInit,
	Output
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IEmployeeProposalTemplate, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { ProposalTemplateService } from '../../../pages/jobs/proposal-template/proposal-template.service';

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

	@Output() selectedChange: EventEmitter<any> = new EventEmitter();

	@Input() disabled = false;
	@Input() multiple = false;

	/*
	* Getter & Setter for employeeId
	*/
	private  _employeeId: string;
	public get employeeId(): string {
		return this._employeeId;
	}
	@Input() public set employeeId(value: string) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	private _proposalTemplateId: string | string[];
	set proposalTemplateId(val: string | string[]) {
		this._proposalTemplateId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get proposalTemplateId(): string | string[] {
		return this._proposalTemplateId;
	}

	constructor(
		private readonly _proposalTemplateService: ProposalTemplateService,
		private readonly _store: Store
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
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._proposalTemplateId = value instanceof Array ? value : [value];
		} else {
			this._proposalTemplateId = value;
		}
	}

	onSelectedChange(selectedItem: IEmployeeProposalTemplate['id']) {
		const proposalTemplate = this.proposalTemplates.find(
			({ id }: IEmployeeProposalTemplate) => id === selectedItem
		);
		this.selectedChange.emit(proposalTemplate || null);
	}

	registerOnChange(fn: (rating: number) => void) {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void) {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean) {
		this.disabled = isDisabled;
	}

	getProposalTemplates() {
		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;

		this._proposalTemplateService
			.getAll({
				where: {
					organizationId, 
					tenantId,
					...(this.employeeId ? { employeeId: this.employeeId } : {}),
				}
			})
			.then(({ items }) => {
				this.proposalTemplates = items;
				this.defaultSelectedTemplate();
			});
	}

	defaultSelectedTemplate() {
		const proposalTemplate = this.proposalTemplates.find(
			({ isDefault }: IEmployeeProposalTemplate) => isDefault === true
		)
		this.proposalTemplateId = (proposalTemplate)?.id || null;
		this.onSelectedChange(this.proposalTemplateId);
	}
}
