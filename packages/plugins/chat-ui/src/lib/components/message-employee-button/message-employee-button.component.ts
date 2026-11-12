import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { IEmployee, IOrganization, IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ChatAvailabilityService } from '../../services/chat-availability.service';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';

/** The route parameter the employee's own page carries the employee id in (`/pages/employees/view/:id`). */
export const EMPLOYEE_VIEW_ID_PARAM = 'id';

/**
 * "Message" on an employee's page (the `employee-view-actions` extension slot), an icon button beside Edit as the
 * ones of a task's page: opens my direct conversation with them in the docked chat window at the bottom right of
 * the screen (`ChatDockService`), so the page stays. Shown only where the API serves the chat to the signed-in user,
 * and not on my own page; the employee is the one of the page's route. Chat is asked in the selected organization
 * (the app sends it with every request), so the button is left out for an employee of another one, whom the chat
 * would not find there.
 */
@Component({
	selector: 'ngx-chat-message-employee-button',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		@if (available() && employeeId() && !isMe() && !otherOrganization()) {
			<button
				nbButton
				ghost
				size="tiny"
				status="basic"
				type="button"
				data-test="message-employee"
				[nbTooltip]="'CHAT.PROFILE.MESSAGE' | translate"
				nbTooltipPlacement="top"
				[attr.aria-label]="'CHAT.PROFILE.MESSAGE' | translate"
				(click)="open()"
			>
				<nb-icon icon="message-circle-outline"></nb-icon>
			</button>
		}
	`
})
export class MessageEmployeeButtonComponent {
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly dock = inject(ChatDockService);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly translate = inject(TranslateService);

	private readonly availability = inject(ChatAvailabilityService);
	protected readonly available = toSignal(this.availability.available$, { initialValue: false });
	protected readonly employeeId = toSignal(
		this.route.paramMap.pipe(
			map((params) => params.get(EMPLOYEE_VIEW_ID_PARAM)),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);
	/** My own employee id, if I am an employee: nobody messages themselves from their own page. */
	private readonly myEmployeeId = toSignal(
		(this.store.user$ as Observable<IUser | null | undefined>).pipe(
			map((user) => user?.employee?.id ?? user?.employeeId ?? null),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);
	protected readonly isMe = computed(() => !!this.myEmployeeId() && this.myEmployeeId() === this.employeeId());

	private readonly organization$ = this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>;
	private readonly selectedOrganizationId = toSignal(
		this.organization$.pipe(
			map((organization) => (organization?.id ? String(organization.id) : null)),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);
	/** The organization of the employee the page shows (the page's route resolves them), when it is known. */
	private readonly employeeOrganizationId = toSignal(
		this.route.data.pipe(
			map((data) => {
				const employee = data?.['employee'] as IEmployee | undefined;
				return employee?.organizationId ? String(employee.organizationId) : null;
			}),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);
	/**
	 * Whether the page's employee is of another organization than the selected one. With no organization selected
	 * the chat looks through the whole tenant, and with theirs unknown nothing is assumed: the button stays.
	 */
	protected readonly otherOrganization = computed(() => {
		const selected = this.selectedOrganizationId();
		const theirs = this.employeeOrganizationId();
		return !!selected && !!theirs && selected !== theirs;
	});

	/** The organization's people as the chat knows them, for the name and picture the window shows. */
	private readonly people = toSignal(
		// Only once the API serves the chat: with chat switched off there, nobody is asked for (no 404 per page visit).
		combineLatest([this.availability.available$, this.organization$]).pipe(
			switchMap(([available, organization]) =>
				available && organization?.id && organization.tenantId
					? this.peopleService.people(organization.id, organization.tenantId)
					: of(EMPTY_PEOPLE)
			)
		),
		{ initialValue: EMPTY_PEOPLE }
	);

	/** Opens the docked window with the page's employee (named "Conversation" while the chat does not know them). */
	protected open(): void {
		const employeeId = this.employeeId();
		if (!employeeId) return;
		// While the people are still loading, the employee the page's route resolved names the window.
		const employee = this.route.snapshot.data?.['employee'] as IEmployee | undefined;
		const person = this.people().byEmployee.get(employeeId) ?? {
			employeeId,
			userId: employee?.userId ? String(employee.userId) : null,
			name: employee?.fullName?.trim() || this.translate.instant('CHAT.UNNAMED'),
			imageUrl: employee?.user?.imageUrl ?? null
		};
		void this.dock.open(person);
	}
}
