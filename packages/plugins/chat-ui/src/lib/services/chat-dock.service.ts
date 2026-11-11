import { Injectable, inject, signal } from '@angular/core';
import { NbComponentPortal, NbOverlayRef, NbOverlayService, NbPositionBuilderService } from '@nebular/theme';
import { ChatPerson } from '../chat-ui.helpers';

/** How far the docked card stands from the bottom and the right edge of the screen. */
export const CHAT_DOCK_EDGE = '1.5rem';

/**
 * The docked chat window: one direct conversation in a small window at the bottom right of the screen, opened from
 * a person's page. It lives in an overlay of the app, not in the page that opened it, so it stays while the user
 * moves through the app, until they close it.
 */
@Injectable({ providedIn: 'root' })
export class ChatDockService {
	private readonly overlay = inject(NbOverlayService);
	private readonly positions = inject(NbPositionBuilderService);

	private ref: NbOverlayRef | null = null;

	/** The person the window is open with, or null while it is closed. */
	readonly person = signal<ChatPerson | null>(null);

	/** Opens the window with this person; when it is already open, it turns to them. */
	async open(person: ChatPerson): Promise<void> {
		this.person.set(person);
		if (this.ref) return;
		// The window itself is loaded the first time it is opened.
		const { ChatDockComponent } = await import('../components/chat-dock/chat-dock.component');
		if (this.ref || !this.person()) return;
		this.ref = this.overlay.create({
			positionStrategy: this.positions.global().bottom(CHAT_DOCK_EDGE).right(CHAT_DOCK_EDGE),
			scrollStrategy: this.overlay.scrollStrategies.noop(),
			hasBackdrop: false
		});
		this.ref.attach(new NbComponentPortal(ChatDockComponent));
	}

	close(): void {
		this.person.set(null);
		this.ref?.dispose();
		this.ref = null;
	}
}
