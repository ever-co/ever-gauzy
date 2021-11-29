import { Component, EventEmitter, forwardRef, Input, OnInit, Output } from "@angular/core";
import { FormControl, NG_VALUE_ACCESSOR } from "@angular/forms";
import { filter, first, tap } from "rxjs/operators";
import { Subject } from "rxjs/internal/Subject";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { distinctUntilChange } from "@gauzy/common-angular";
import { IOrganization, ITimeOffPolicy } from "@gauzy/contracts";
import { Store, TimeOffService } from "../../../@core/services";


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-off-policy-select',
	templateUrl: './time-off-policy-select.component.html',
	styleUrls: [],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimeOffPolicySelectComponent),
			multi: true
		}
	]
})
export class TimeOffPolicySelectComponent implements OnInit {
	
	private _policy: ITimeOffPolicy;

	policies: ITimeOffPolicy[] = [];
	public organization: IOrganization;
	policies$: Subject<any> = new Subject();

	onChange: any = () => {};
	onTouched: any = () => {};

	@Output() selectedChange: EventEmitter<any> = new EventEmitter();

	/*
	* Getter & Setter for policy
	*/
	@Input() set policy(val: ITimeOffPolicy) {
		this._policy = val;
		this.onChange(val);
		this.onTouched();
	}
	get policy() {
		return this._policy;
	}

	/*
	* Getter & Setter accessor for dynamic form control
	*/
	_ctrl: FormControl = new FormControl(); 
	get ctrl(): FormControl {
		return this._ctrl;
	}
	@Input() set ctrl(value: FormControl) {
		this._ctrl = value;
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

	// ID attribute for the field and for attribute for the label
	_id: string;
	get id(): string {
		return this._id;
	}
	@Input() set id(value: string) {
		this._id = value;
	}

	constructor(
		private readonly _store: Store,
		private readonly timeOffService: TimeOffService
	) {}

	ngOnInit() {
		this.policies$
			.pipe(
				tap(() => this.getTimeOffPolicies()),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.policies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: ITimeOffPolicy) {
		if (value) {
			this.policy = value;
		}
	}

	registerOnChange(fn: (rating: number) => void) {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void) {
		this.onTouched = fn;
	}

	/**
	 * On policy select
	 * 
	 * @param selectedItem 
	 */
	onSelectedChange(policy: ITimeOffPolicy) {
		this.selectedChange.emit(policy || null);
	}

	/**
	 * GET time off policies
	 * 
	 * @returns 
	 */
	getTimeOffPolicies() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;

		this.timeOffService.getAllPolicies(['employees'], {
			organizationId,
			tenantId
		})
		.pipe(
			first(),
			tap(({ items }) => this.policies = items)
		)
		.subscribe();
	}
}
