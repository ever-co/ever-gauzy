import {
	Component,
	OnInit,
	OnDestroy,
	ChangeDetectorRef,
	ElementRef,
	QueryList,
	ViewChild,
	ViewChildren
} from '@angular/core';
import { FormBuilder, FormGroup, NgForm } from '@angular/forms';
import { filter, tap } from 'rxjs';
import { NbAccordionComponent, NbAccordionItemComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { DEFAULT_TIME_FORMATS } from '@gauzy/constants';
import { IEmployee, isEEAOrUKRegion } from '@gauzy/contracts';
import { EmployeeStore, applyEEAUKFormRestrictions, bindAgentRestrictionListeners } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-settings',
	templateUrl: './edit-employee-other-settings.component.html',
	styleUrls: ['./edit-employee-other-settings.component.scss'],
	standalone: false
})
export class EditEmployeeOtherSettingsComponent implements OnInit, OnDestroy {
	listOfTimeFormats = DEFAULT_TIME_FORMATS;
	selectedEmployee: IEmployee;
	public acknowledgeAgentExitLogoutRestriction: boolean = false;

	public get isEEAOrUK(): boolean {
		if (!this.selectedEmployee) return false;
		const userTz = this.selectedEmployee.user?.timeZone;
		const formTz = this.form?.get('timeZone')?.value;
		const activeTz =
			userTz ||
			(formTz && formTz !== moment.tz.guess() ? formTz : undefined) ||
			this.selectedEmployee.organization?.timeZone;
		return isEEAOrUKRegion({
			regionCode: this.selectedEmployee.organization?.regionCode || this.selectedEmployee.contact?.regionCode,
			timeZone: activeTz,
			country: this.selectedEmployee.contact?.country || this.selectedEmployee.organization?.contact?.country
		});
	}

	/**
	 * Nebular Accordion Main Component
	 */
	accordion: NbAccordionComponent;
	@ViewChild('accordion') set content(content: NbAccordionComponent) {
		if (content) {
			this.accordion = content;
			this.cdr.detectChanges();
		}
	}

	/**
	 * Nebular Accordion Item Components
	 */
	@ViewChild('general') general: NbAccordionItemComponent;
	@ViewChild('integrations') integrations: NbAccordionItemComponent;
	@ViewChild('timer') timer: NbAccordionItemComponent;
	@ViewChild('agent') agent: NbAccordionItemComponent;

	@ViewChildren(NbAccordionItemComponent) private readonly accordionItems: QueryList<NbAccordionItemComponent>;

	@ViewChildren(NbAccordionItemComponent, { read: ElementRef })
	private readonly accordionItemElements: QueryList<ElementRef<HTMLElement>>;

	/**
	 * Reveal a settings section from the rail.
	 *
	 * The rail used to call `toggle()` on the accordion item and stop there, which
	 * had two consequences. Clicking the section you were already reading closed it
	 * — leaving the rail with nothing marked active while its fields were still the
	 * ones on screen — and, because the sections are one scrolling column, opening
	 * anything below the fold moved nothing into view, so the lower entries looked
	 * inert. This is an index into the page, so it opens rather than toggles, and
	 * brings the section it opened with it. Same behaviour as the organization
	 * settings rail (`edit-organization-other-settings.component.ts`).
	 *
	 * @param item the accordion section the rail entry points at
	 */
	openSection(item: NbAccordionItemComponent): void {
		if (!item) {
			return;
		}
		if (!item.expanded) {
			item.open();
		}
		// The two `ViewChildren` queries walk the same template in the same order, so
		// an item's position in one is its element's position in the other.
		const index = this.accordionItems?.toArray().indexOf(item) ?? -1;
		if (index < 0) {
			return;
		}
		setTimeout(() => {
			this.accordionItemElements?.get(index)?.nativeElement?.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}, 0);
	}

	/**
	 * Employee other settings settings
	 */
	public form: FormGroup = EditEmployeeOtherSettingsComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			timeZone: [],
			timeFormat: [],
			upworkId: [],
			linkedInId: [],
			allowManualTime: [false],
			allowModifyTime: [false],
			allowDeleteTime: [false],
			allowScreenshotCapture: [true],
			allowAgentAppExit: [true],
			allowLogoutFromAgentApp: [true],
			trackKeyboardMouseActivity: [false],
			trackAllDisplays: [true]
		});
	}

	constructor(
		private readonly cdr: ChangeDetectorRef,
		private readonly fb: FormBuilder,
		private readonly employeeStore: EmployeeStore,
		private readonly translateService: TranslateService
	) {}

	/**
	 *
	 */
	ngOnInit(): void {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => {
					this.selectedEmployee = employee;
					this._patchFormValue(employee);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		bindAgentRestrictionListeners(
			this.form,
			() => this.isEEAOrUK,
			(field) => this.selectedEmployee?.[field],
			this.translateService,
			untilDestroyed(this),
			() => (this.acknowledgeAgentExitLogoutRestriction = true)
		);

		// Reapply EEA/UK form restrictions when the timezone changes
		this.form.get('timeZone')?.valueChanges
			.pipe(
				tap(() => applyEEAUKFormRestrictions(this.form, this.isEEAOrUK)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Patches the form with employee data or default values if data is unavailable.
	 *
	 * @param {IEmployee} employee - The employee object containing user data.
	 * @returns {void}
	 */
	private _patchFormValue(employee: IEmployee): void {
		if (!employee) return;

		this.acknowledgeAgentExitLogoutRestriction = false;

		const {
			user,
			upworkId,
			linkedInId,
			allowManualTime,
			allowDeleteTime,
			allowModifyTime,
			allowScreenshotCapture,
			allowAgentAppExit,
			allowLogoutFromAgentApp,
			trackKeyboardMouseActivity,
			trackAllDisplays
		} = employee;
		this.form.patchValue({
			timeZone: user?.timeZone ?? moment.tz.guess(),
			timeFormat: user?.timeFormat,
			upworkId,
			linkedInId,
			allowManualTime,
			allowDeleteTime,
			allowModifyTime,
			allowScreenshotCapture,
			allowAgentAppExit: allowAgentAppExit ?? true,
			allowLogoutFromAgentApp: allowLogoutFromAgentApp ?? true,
			trackKeyboardMouseActivity: trackKeyboardMouseActivity ?? false,
			trackAllDisplays: trackAllDisplays ?? true
		});

		applyEEAUKFormRestrictions(this.form, this.isEEAOrUK);

		this.form.updateValueAndValidity();
	}

	/**
	 * Handles the form submission, updating employee and user settings if valid.
	 *
	 * @param {NgForm} form - The form reference for submission.
	 * @returns {void}
	 */
	onSubmit(form: NgForm): void {
		if (form.invalid) return;

		const { organizationId, tenantId } = this.selectedEmployee;
		const {
			timeZone,
			timeFormat,
			upworkId,
			linkedInId,
			allowManualTime,
			allowDeleteTime,
			allowModifyTime,
			allowScreenshotCapture,
			allowAgentAppExit,
			allowLogoutFromAgentApp,
			trackKeyboardMouseActivity,
			trackAllDisplays
		} = this.form.getRawValue();

		this.employeeStore.updateUserForm({ timeZone, timeFormat });
		this.employeeStore.updateEmployeeForm({
			upworkId,
			linkedInId,
			organizationId,
			tenantId,
			allowManualTime,
			allowDeleteTime,
			allowModifyTime,
			allowScreenshotCapture,
			allowAgentAppExit,
			allowLogoutFromAgentApp,
			trackKeyboardMouseActivity,
			trackAllDisplays,
			acknowledgeAgentExitLogoutRestriction: this.acknowledgeAgentExitLogoutRestriction
		});
	}

	/**
	 *
	 */
	ngOnDestroy(): void {}
}
