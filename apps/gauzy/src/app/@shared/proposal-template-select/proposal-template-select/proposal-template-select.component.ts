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
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { ProposalTemplateService } from '../../../pages/jobs/proposal-template/proposal-template.service';

const noop = () => {};

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
	private _proposalTemplateId: string | string[];
	private _employeeId: string;

	proposalTemplates: IEmployeeProposalTemplate[] = [];
	organization: IOrganization;
	loadProposalTemplates$: Subject<any> = new Subject();
	onChange: any = noop;
	onTouched: any = noop;
	organizationId: string;

	@Output() selectedChange: EventEmitter<any> = new EventEmitter();

	@Input() disabled = false;
	@Input() multiple = false;
	@Input()
	public get employeeId() {
		return this._employeeId;
	}
	public set employeeId(value) {
		this._employeeId = value;
		this.loadProposalTemplates$.next();
	}

	set proposalTemplateId(val: string | string[]) {
		this._proposalTemplateId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get proposalTemplateId(): string | string[] {
		return this._proposalTemplateId;
	}

	constructor(
		private proposalTemplateService: ProposalTemplateService,
		private store: Store
	) {}

	ngOnInit() {
		this.loadProposalTemplates$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(async () => {
				const { tenantId } = this.store.user;
				const { id: organizationId } = this.organization;

				this.proposalTemplateService
					.getAll({
						where: {
							...(this.employeeId
								? { employeeId: this.employeeId }
								: {}),
							...(this.organizationId
								? { organizationId, tenantId }
								: {})
						}
					})
					.then((resp) => {
						this.proposalTemplates = resp.items;
					});
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this.organizationId = organization.id;
					this.loadProposalTemplates$.next();
				}
			});
	}

	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._proposalTemplateId = value instanceof Array ? value : [value];
		} else {
			this._proposalTemplateId = value;
		}
	}

	onSelectedChange(selectedItem) {
		this.selectedChange.emit(selectedItem);
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
}
