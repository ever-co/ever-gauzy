import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { ChatAvailabilityService } from '../../services/chat-availability.service';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatUiService } from '../../services/chat-ui.service';

/** The route parameter the team's own page carries the team id in (`/pages/organization/teams/view/:id`). */
export const TEAM_VIEW_ID_PARAM = 'id';

/**
 * "Team chat" on a team's page (the `team-view-actions` extension slot), an icon button beside the favorite toggle as
 * "Message" is on an employee's page: opens the team's channel in the docked chat window at the bottom right of the
 * screen (`ChatDockService`), so the page stays. The channel is the one named as the team; the window joins it, or,
 * when there is none, creates it with the team's members on the first message sent. Shown only where the API serves
 * the chat to the signed-in user; the team is the one of the page's route, read in the selected organization.
 */
@Component({
	selector: 'ngx-chat-team-chat-button',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		@if (available() && teamId()) {
			<button
				nbButton
				ghost
				size="tiny"
				status="basic"
				type="button"
				data-test="team-chat"
				[disabled]="opening()"
				[nbTooltip]="'CHAT.PROFILE.TEAM_CHAT' | translate"
				nbTooltipPlacement="top"
				[attr.aria-label]="'CHAT.PROFILE.TEAM_CHAT' | translate"
				(click)="open()"
			>
				<nb-icon icon="message-circle-outline"></nb-icon>
			</button>
		}
	`
})
export class TeamChatButtonComponent {
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly dock = inject(ChatDockService);
	private readonly api = inject(ChatUiService);
	private readonly toastr = inject(ToastrService);

	protected readonly available = toSignal(inject(ChatAvailabilityService).available$, { initialValue: false });
	protected readonly teamId = toSignal(
		this.route.paramMap.pipe(
			map((params) => params.get(TEAM_VIEW_ID_PARAM)),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);
	private readonly organization = toSignal(this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>, {
		initialValue: null
	});
	/** While the team is read: a second click waits for it. */
	protected readonly opening = signal(false);

	/** Reads the team (its name and members, for its channel) and opens the docked window with its channel. */
	protected async open(): Promise<void> {
		const teamId = this.teamId();
		const organization = this.organization();
		if (!teamId || !organization?.id || !organization.tenantId || this.opening()) return;
		this.opening.set(true);
		try {
			const team = await firstValueFrom(this.api.team(teamId, organization.id, organization.tenantId));
			// The page left meanwhile for another team: that one is not opened for this click.
			if (!team || this.teamId() !== teamId) return;
			await this.dock.openTeam(team);
		} catch {
			this.toastr.danger('CHAT.DIALOG.FAILED');
		} finally {
			this.opening.set(false);
		}
	}
}
