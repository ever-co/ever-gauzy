import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import { CHAT_MENTION_SUGGESTIONS } from '../../chat-ui.constants';
import { ChatPerson, mentionQueryAt, namesToTokens, suggestMentions, tokensToNames, uniqueLabel } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What the composer hands over: the body with mention tokens, and the employees it mentions. */
export interface ComposerSubmission {
	body: string;
	mentionEmployeeIds: string[];
}

/** The unsent text of each conversation and thread, kept while the page lives (a switch and back finds it again). */
const DRAFTS = new Map<string, string>();

/**
 * The text box of a conversation or a thread: Enter sends, Shift+Enter breaks the line, `@` opens the people
 * suggestions (arrows, Enter, Escape). In edit mode it starts with the message's text and offers Save / Cancel.
 * Mentions show as `@Name` (`#channel`) while writing and go out as tokens; each label stands for one id, so two
 * people of one name never swap. The length that counts is the tokenized body's, the one the API measures.
 */
@Component({
	selector: 'ngx-chat-message-composer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbIconModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<div class="composer" data-test="composer">
			@if (suggestions().length > 0) {
				<ul class="suggestions" role="listbox" data-test="mention-suggestions">
					@for (person of suggestions(); track person.employeeId; let index = $index) {
						<li role="option" [attr.aria-selected]="index === highlighted()" [class.highlighted]="index === highlighted()" (mousedown)="$event.preventDefault(); pick(person)">
							<ngx-chat-person-avatar [person]="person" size="small"></ngx-chat-person-avatar>
							<span>{{ person.name }}</span>
						</li>
					}
				</ul>
			}
			<textarea
				#box
				nbInput
				fullWidth
				rows="1"
				class="box"
				data-test="composer-box"
				[placeholder]="placeholder()"
				[disabled]="disabled()"
				[attr.aria-label]="placeholder()"
				[attr.maxlength]="max"
				[(ngModel)]="text"
				(ngModelChange)="onInput()"
				(keydown)="onKeyDown($event)"
				(keyup)="onCaretMove()"
				(click)="onCaretMove()"
			></textarea>
			<div class="footer">
				<span class="hint" [class.over]="isTooLong()">
					@if (isTooLong()) {
						{{ 'CHAT.COMPOSER.TOO_LONG' | translate: { max: max } }}
					} @else {
						{{ 'CHAT.COMPOSER.HINT' | translate }}
					}
				</span>
				<span class="buttons">
					@if (editing()) {
						<button nbButton ghost size="tiny" type="button" data-test="composer-cancel" (click)="cancel.emit()">{{ 'CHAT.COMPOSER.CANCEL' | translate }}</button>
					}
					<button nbButton status="primary" size="tiny" type="button" data-test="composer-send" [disabled]="!canSend()" (click)="send()">
						{{ (editing() ? 'CHAT.COMPOSER.SAVE' : 'CHAT.COMPOSER.SEND') | translate }}
					</button>
				</span>
			</div>
		</div>
	`,
	styles: [
		`
			.composer {
				position: relative;
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}
			.box {
				resize: vertical;
				min-height: 2.5rem;
				max-height: 12rem;
				font: inherit;
			}
			.footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}
			.hint {
				font-size: 0.6875rem;
				opacity: 0.6;
			}
			.hint.over {
				opacity: 1;
				color: var(--color-danger-default, #e4493f);
			}
			.buttons {
				display: flex;
				gap: 0.25rem;
			}
			.suggestions {
				position: absolute;
				bottom: 100%;
				left: 0;
				z-index: 20;
				min-width: 14rem;
				max-height: 14rem;
				overflow-y: auto;
				margin: 0 0 0.25rem;
				padding: 0.25rem;
				list-style: none;
				border-radius: 0.375rem;
				background: var(--card-background-color, #fff);
				box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
			}
			.suggestions li {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.25rem 0.5rem;
				border-radius: 0.25rem;
				cursor: pointer;
				font-size: 0.875rem;
			}
			.suggestions li.highlighted,
			.suggestions li:hover {
				background: rgba(127, 127, 127, 0.15);
			}
		`
	]
})
export class MessageComposerComponent {
	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	readonly placeholder = input('');
	readonly disabled = input(false);
	/** The message being edited (its body with tokens), or null for a new message. */
	readonly initialBody = input<string | null>(null);
	readonly editing = input(false);
	/** Where the unsent text belongs (a conversation, a thread): it is kept per key and found again on return. */
	readonly draftKey = input<string | null>(null);
	/** Clears the box (and the draft of the key) after this submission counter changes (the parent sent it). */
	readonly resetToken = input(0);

	readonly submitted = output<ComposerSubmission>();
	readonly cancel = output<void>();

	private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	protected text = '';
	/** `@label` → employee id and `#label` → conversation id, as shown in the box. */
	private picked = new Map<string, string>();
	private channels = new Map<string, string>();
	/** Whether the person typed since the box was last filled (a late people list must not overwrite that). */
	private dirty = false;
	private lastReset = 0;
	protected readonly length = signal(0);
	protected readonly query = signal<{ query: string; start: number } | null>(null);
	protected readonly highlighted = signal(0);

	protected readonly suggestions = computed(() => {
		const query = this.query();
		if (!query) return [] as ChatPerson[];
		return suggestMentions(this.people().list, query.query, CHAT_MENTION_SUGGESTIONS);
	});
	protected readonly isTooLong = computed(() => this.length() > this.max);
	protected readonly canSend = computed(() => this.length() > 0 && !this.isTooLong() && !this.disabled());

	constructor() {
		// The box is filled when the edited message or the place changes: with the message's text, or the draft of the place.
		effect(() => {
			const initial = this.initialBody();
			const key = this.draftKey();
			untracked(() => this.fill(initial, key));
		});
		// Names that arrive after the box was filled replace the `…` labels, as long as nothing was typed since.
		effect(() => {
			this.people();
			this.conversationNames();
			untracked(() => {
				const initial = this.initialBody();
				if (initial !== null && !this.dirty) this.fill(initial, this.draftKey());
			});
		});
		effect(() => {
			const token = this.resetToken();
			untracked(() => {
				if (token === this.lastReset) return;
				this.lastReset = token;
				this.clear();
			});
		});
	}

	focus(): void {
		this.box()?.nativeElement.focus();
	}

	private fill(initial: string | null, key: string | null): void {
		if (initial !== null) {
			const labels = tokensToNames(initial, this.people().byEmployee, this.conversationNames());
			this.text = labels.text;
			this.picked = labels.people;
			this.channels = labels.channels;
			queueMicrotask(() => this.focus());
		} else {
			const labels = tokensToNames(key ? (DRAFTS.get(key) ?? '') : '', this.people().byEmployee, this.conversationNames());
			this.text = labels.text;
			this.picked = labels.people;
			this.channels = labels.channels;
		}
		this.dirty = false;
		this.query.set(null);
		this.measure();
	}

	private clear(): void {
		this.text = '';
		this.picked = new Map();
		this.channels = new Map();
		this.dirty = false;
		const key = this.draftKey();
		if (key) DRAFTS.delete(key);
		this.length.set(0);
		this.query.set(null);
	}

	/** The body as the API would receive it, and its length (the one that counts). */
	private tokenized(): string {
		return namesToTokens(this.text.trim(), this.picked, this.channels);
	}

	private measure(): void {
		this.length.set(this.tokenized().length);
	}

	private keepDraft(): void {
		const key = this.draftKey();
		if (!key || this.editing()) return;
		const body = this.tokenized();
		if (body) DRAFTS.set(key, body);
		else DRAFTS.delete(key);
	}

	protected onInput(): void {
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.onCaretMove();
	}

	protected onCaretMove(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		const next = mentionQueryAt(this.text, element.selectionStart ?? this.text.length);
		const current = this.query();
		if (next?.query !== current?.query || next?.start !== current?.start) {
			this.query.set(next);
			this.highlighted.set(0);
		}
	}

	protected onKeyDown(event: KeyboardEvent): void {
		const suggestions = this.suggestions();
		if (suggestions.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				this.highlighted.set((this.highlighted() + 1) % suggestions.length);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				this.highlighted.set((this.highlighted() - 1 + suggestions.length) % suggestions.length);
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				this.pick(suggestions[this.highlighted()]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.query.set(null);
				return;
			}
		}
		if (event.key === 'Escape' && this.editing()) {
			event.preventDefault();
			this.cancel.emit();
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			this.send();
		}
	}

	protected pick(person: ChatPerson): void {
		const query = this.query();
		const element = this.box()?.nativeElement;
		if (!query || !element) return;
		const caret = element.selectionStart ?? this.text.length;
		const label = uniqueLabel(person.name, person.employeeId, this.picked);
		const insertion = `@${label} `;
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
		this.picked.set(label, person.employeeId);
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.query.set(null);
		const position = query.start + insertion.length;
		queueMicrotask(() => {
			element.focus();
			element.setSelectionRange(position, position);
		});
	}

	protected send(): void {
		if (!this.canSend()) return;
		const body = this.tokenized();
		const mentionEmployeeIds = [...new Set([...this.picked.values()].filter((id) => body.includes(`<@${id}>`)))];
		this.submitted.emit({ body, mentionEmployeeIds });
	}
}
