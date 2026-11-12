import { Injectable, inject, signal } from '@angular/core';
import { NbComponentPortal, NbOverlayRef, NbOverlayService, NbPositionBuilderService } from '@nebular/theme';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { ChatPerson } from '../chat-ui.helpers';
import { ChatAvailabilityService } from './chat-availability.service';

/** How far the docked card stands from the bottom and the right edge of the screen. */
export const CHAT_DOCK_EDGE = '1.5rem';

/**
 * The docked chat window: one direct conversation in a small window at the bottom right of the screen, opened from
 * a person's page. It lives in an overlay of the app, not in the page that opened it, so it stays while the user
 * moves through the app, until they close it — or until the chat's scope changes (another user, another
 * organization): a conversation belongs to the scope it was opened in, as on the chat page, so the window closes
 * then and its requests end with it.
 */
@Injectable({ providedIn: 'root' })
export class ChatDockService {
	private readonly overlay = inject(NbOverlayService);
	private readonly positions = inject(NbPositionBuilderService);
	private readonly scope$ = inject(ChatAvailabilityService).scope$;

	private ref: NbOverlayRef | null = null;
	/** Watches the scope while the window is open. */
	private scopeWatch: Subscription | null = null;
	/** Counts up at every open and close, so an open that was waiting for the window's code is dropped by a later close. */
	private token = 0;

	/** The person the window is open with, or null while it is closed. */
	readonly person = signal<ChatPerson | null>(null);

	/** Opens the window with this person; when it is already open, it turns to them. */
	async open(person: ChatPerson): Promise<void> {
		this.person.set(person);
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
		this.person.set(null);
		this.ref?.dispose();
		this.ref = null;
	}
}
