import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { IChatFile, IChatMessage } from '@gauzy/contracts';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatUiService } from './chat-ui.service';

function unansweredKey(conversationId: string, documentId: string): string {
	return `${conversationId}|${documentId}`;
}

/** How many of a conversation's newest files one read takes (the API's maximum page). */
export const CHAT_FILES_READ = 200;

/**
 * The files the messages on screen carry, by document id: what a message needs to show its pictures and files.
 * Read through the conversation's files (`GET /chat/conversations/:id/files`, members only), never through the
 * documents themselves, so a member sees a file another member attached to a private channel. A conversation is
 * read again only when a message names a document not read yet; a document a read did not answer (a file deleted
 * since, or older than the newest {@link CHAT_FILES_READ}) is not asked for again, and its message counts it.
 * Everything is dropped when the user or the organization changes.
 */
@Injectable({ providedIn: 'root' })
export class ChatFilesStore {
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);

	private readonly files = signal<ReadonlyMap<string, IChatFile>>(new Map());
	/** Every file read so far, by document id. */
	readonly byDocument = this.files.asReadonly();

	private readonly reading = new Set<string>();
	/** The documents named while a conversation was being read: asked for again once that read ends. */
	private readonly again = new Map<string, Set<string>>();
	/** The documents a read of a conversation did not answer (`<conversationId>|<documentId>`). */
	private readonly unanswered = new Set<string>();
	private scope = 0;

	constructor() {
		inject(ChatAvailabilityService)
			.scope$.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.reset());
	}

	/** Reads the files of a conversation when one of these messages names a document not read yet. */
	ensureFor(conversationId: string, messages: readonly Pick<IChatMessage, 'attachmentIds'>[]): void {
		const ids = messages.flatMap((message) => message.attachmentIds ?? []).map(String);
		this.ensure(conversationId, ids);
	}

	ensure(conversationId: string, documentIds: readonly string[]): void {
		const known = this.files();
		if (!documentIds.some((id) => !known.has(id) && !this.unanswered.has(unansweredKey(conversationId, id)))) return;
		if (this.reading.has(conversationId)) {
			const later = this.again.get(conversationId) ?? new Set<string>();
			for (const id of documentIds) later.add(id);
			this.again.set(conversationId, later);
			return;
		}
		this.read(conversationId, documentIds);
	}

	/** Files read elsewhere (the files pane): kept for the messages too. */
	add(files: readonly IChatFile[]): void {
		if (!files.length) return;
		const next = new Map(this.files());
		for (const file of files) next.set(String(file.documentId), file);
		this.files.set(next);
	}

	private read(conversationId: string, wanted: readonly string[]): void {
		const scope = this.scope;
		this.reading.add(conversationId);
		this.api
			.files(conversationId, { limit: CHAT_FILES_READ })
			.pipe(
				finalize(() => this.finish(conversationId, scope)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (result) => {
					if (scope !== this.scope) return;
					this.add(result.files);
					const known = this.files();
					for (const id of wanted) if (!known.has(id)) this.unanswered.add(unansweredKey(conversationId, id));
				},
				error: () => {
					if (scope !== this.scope) return;
					for (const id of wanted) this.unanswered.add(unansweredKey(conversationId, id));
				}
			});
	}

	private finish(conversationId: string, scope: number): void {
		if (scope !== this.scope) return;
		this.reading.delete(conversationId);
		const later = this.again.get(conversationId);
		this.again.delete(conversationId);
		if (later?.size) this.ensure(conversationId, [...later]);
	}

	private reset(): void {
		this.scope += 1;
		this.files.set(new Map());
		this.reading.clear();
		this.again.clear();
		this.unanswered.clear();
	}
}
