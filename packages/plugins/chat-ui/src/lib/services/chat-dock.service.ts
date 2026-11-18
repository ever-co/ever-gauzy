import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { NbComponentPortal, NbOverlayRef, NbOverlayService, NbPositionBuilderService } from '@nebular/theme';
import { Subscription } from 'rxjs';
import { filter, skip } from 'rxjs/operators';
import { ChatPerson } from '../chat-ui.helpers';
import { ChatAvailabilityService } from './chat-availability.service';
import type { IChatConversationWithState } from '@gauzy/contracts';
import type { ChatTeamDetails } from './chat-ui.service';

/**
 * The work left on a team's channel after a first message created it, kept until it is done: the channel the team
 * chats in (joined first when `mustJoin`), the empty duplicates made here to archive, and the members still to add,
 * in batches the API takes. A step that failed stays, and is tried again before the next message and when the team's
 * card opens again.
 */
export interface ChatTeamChannelSetup {
	channel: IChatConversationWithState;
	mustJoin: boolean;
	archiveIds: string[];
	batches: string[][];
}

/** How far the docked card stands from the bottom and the right edge of the screen. */
export const CHAT_DOCK_EDGE = '1.5rem';

/**
 * A URL's page: its path, without the query, the fragment, or each segment's matrix parameters — every segment kept,
 * so a tab switch (a query or matrix change) stays on the page and another record (a later segment) does not.
 */
export function pageOf(url: string): string {
	return url
		.split(/[?#]/)[0]
		.split('/')
		.map((segment) => segment.split(';')[0])
		.join('/');
}

/**
 * The docked chat window: one conversation in a small window at the bottom right of the screen — a direct one,
 * opened from a person's page, or a team's channel, opened from the team's page. It lives in an overlay of the app
 * and belongs to the page it was opened on: leaving that page closes it, as the user closing it does. It also closes when the chat's scope changes (another user, another
 * organization): a conversation belongs to the scope it was opened in, as on the chat page, so its requests end
 * with it.
 */
@Injectable({ providedIn: 'root' })
export class ChatDockService {
	private readonly overlay = inject(NbOverlayService);
	private readonly positions = inject(NbPositionBuilderService);
	private readonly router = inject(Router);
	private readonly scope$ = inject(ChatAvailabilityService).scope$;

	private ref: NbOverlayRef | null = null;
	/** Watches the scope while the window is open. */
	private scopeWatch: Subscription | null = null;
	/** Watches the navigation while the window is open: another page closes it. */
	private pageWatch: Subscription | null = null;
	/** Counts up at every open and close, so an open that was waiting for the window's code is dropped by a later close. */
	private token = 0;

	/** The person the window is open with, or null while it is closed or open with a team. */
	readonly person = signal<ChatPerson | null>(null);
	/** The team whose channel the window is open with, or null while it is closed or open with a person. */
	readonly team = signal<ChatTeamDetails | null>(null);
	/**
	 * The unfinished set-ups of team channels, by user, organization and team (see `ChatTeamChannelSetup`): they
	 * outlive the window, so closing it and opening the team again finishes them.
	 */
	readonly teamSetups = new Map<string, ChatTeamChannelSetup>();

	/** Opens the window with this person; when it is already open, it turns to them. */
	async open(person: ChatPerson): Promise<void> {
		this.team.set(null);
		this.person.set(person);
		await this.show();
	}

	/** Opens the window with this team's channel; when it is already open, it turns to it. */
	async openTeam(team: ChatTeamDetails): Promise<void> {
		this.person.set(null);
		this.team.set(team);
		await this.show();
	}

	/** Shows the window (once) and ties it to the current page and scope. */
	private async show(): Promise<void> {
		// The page it is opened (or turned to someone else) on is the one it belongs to.
		const page = pageOf(this.router.url);
		this.pageWatch?.unsubscribe();
		this.pageWatch = this.router.events
			.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
			.subscribe((event) => {
				if (pageOf(event.urlAfterRedirects) !== page) this.close();
			});
		if (this.ref) return;
		const token = (this.token += 1);
		// The scope the window is opened in is the current one (replayed): every later one closes it.
		this.scopeWatch?.unsubscribe();
		this.scopeWatch = this.scope$.pipe(skip(1)).subscribe(() => this.close());
		// The window itself is loaded the first time it is opened.
		const { ChatDockComponent } = await import('../components/chat-dock/chat-dock.component');
		if (this.ref || token !== this.token) return;
		this.ref = this.overlay.create({
			positionStrategy: this.positions.global().bottom(CHAT_DOCK_EDGE).right(CHAT_DOCK_EDGE),
			scrollStrategy: this.overlay.scrollStrategies.noop(),
			hasBackdrop: false
		});
		this.ref.attach(new NbComponentPortal(ChatDockComponent));
	}

	close(): void {
		this.token += 1;
		this.scopeWatch?.unsubscribe();
		this.scopeWatch = null;
		this.pageWatch?.unsubscribe();
		this.pageWatch = null;
		this.person.set(null);
		this.team.set(null);
		this.ref?.dispose();
		this.ref = null;
	}
}
