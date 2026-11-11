import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { IOrganization, IUser } from '@gauzy/contracts';
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
 * and not on my own page; the employee is the one of the page's route.
 */
@Component({
	selector: 'ngx-chat-message-employee-button',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		@if (available() && employeeId() && !isMe()) {
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
	private readonly dock = inject(ChatDockService);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly translate = inject(TranslateService);

	protected readonly available = toSignal(inject(ChatAvailabilityService).available$, { initialValue: false });
	protected readonly employeeId = toSignal(
		inject(ActivatedRoute).paramMap.pipe(
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

	/** The organization's people as the chat knows them, for the name and picture the window shows. */
	private readonly people = toSignal(
		(this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>).pipe(
			switchMap((organization) =>
				organization?.id && organization.tenantId ? this.peopleService.people(organization.id, organization.tenantId) : of(EMPTY_PEOPLE)
			)
		),
		{ initialValue: EMPTY_PEOPLE }
	);

	/** Opens the docked window with the page's employee (named "Conversation" while the chat does not know them). */
	protected open(): void {
		const employeeId = this.employeeId();
		if (!employeeId) return;
		const person = this.people().byEmployee.get(employeeId) ?? {
			employeeId,
			userId: null,
			name: this.translate.instant('CHAT.UNNAMED'),
			imageUrl: null
		};
		void this.dock.open(person);
	}
}
