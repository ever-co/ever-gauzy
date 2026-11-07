import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import { CHAT_MENTION_SUGGESTIONS } from '../../chat-ui.constants';
import { ChatPerson, mentionQueryAt, splitMentions, suggestMentions } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What the composer hands over: the body with mention tokens, and the employees it mentions. */
export interface ComposerSubmission {
	body: string;
	mentionEmployeeIds: string[];
}

/** The body as the person reads it while writing: tokens shown as `@Name`, turned back into tokens on send. */
export function tokensToNames(body: string, people: ChatPeople): { text: string; picked: Map<string, string> } {
	const picked = new Map<string, string>();
	const text = splitMentions(body, people.byEmployee, new Map(), null)
		.map((part) => {
			if (part.kind === 'text') return part.text;
			if (part.kind === 'mention') {
				picked.set(part.label, part.employeeId);
				return `@${part.label}`;
			}
			if (part.kind === 'channel') return `#${part.label}`;
			return `@${part.label}`;
		})
		.join('');
	return { text, picked };
}

/** `@Name` back into `<@employeeId>` for the names that were picked, longest names first, plus `@channel` / `@here`. */
export function namesToTokens(text: string, picked: ReadonlyMap<string, string>): string {
	let out = text;
	for (const [name, id] of [...picked.entries()].sort((a, b) => b[0].length - a[0].length)) {
		out = out.split(`@${name}`).join(`<@${id}>`);
	}
	return out.replace(/(^|\s)@(channel|here)(?=\s|$|[.,!?])/g, '$1<!$2>');
}

/**
 * The text box of a conversation or a thread: Enter sends, Shift+Enter breaks the line, `@` opens the people
 * suggestions (arrows, Enter, Escape). In edit mode it starts with the message's text and offers Save / Cancel.
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
				color: #e4493f;
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
	readonly placeholder = input('');
	readonly disabled = input(false);
	/** The message being edited (its body with tokens), or null for a new message. */
	readonly initialBody = input<string | null>(null);
	readonly editing = input(false);
	/** Clears the box after this submission counter changes (the parent sent it). */
	readonly resetToken = input(0);

	readonly submitted = output<ComposerSubmission>();
	readonly cancel = output<void>();

	private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	protected text = '';
	private picked = new Map<string, string>();
	protected readonly length = signal(0);
	protected readonly query = signal<{ query: string; start: number } | null>(null);
	protected readonly highlighted = signal(0);

	readonly suggestions = computed(() => {
		const query = this.query();
		if (!query) return [] as ChatPerson[];
		return suggestMentions(this.people().list, query.query, CHAT_MENTION_SUGGESTIONS);
	});
	readonly isTooLong = computed(() => this.length() > this.max);
	readonly canSend = computed(() => this.length() > 0 && !this.isTooLong() && !this.disabled());

	constructor() {
		effect(() => {
			const initial = this.initialBody();
			const { text, picked } = tokensToNames(initial ?? '', this.people());
			this.text = text;
			this.picked = picked;
			this.length.set(text.trim().length);
			if (initial !== null) queueMicrotask(() => this.focus());
		});
		effect(() => {
			this.resetToken();
			this.text = '';
			this.picked = new Map();
			this.length.set(0);
			this.query.set(null);
		});
	}

	focus(): void {
		this.box()?.nativeElement.focus();
	}

	protected onInput(): void {
		this.length.set(this.text.trim().length);
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
		const insertion = `@${person.name} `;
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
		this.picked.set(person.name, person.employeeId);
		this.length.set(this.text.trim().length);
		this.query.set(null);
		const position = query.start + insertion.length;
		queueMicrotask(() => {
			element.focus();
			element.setSelectionRange(position, position);
		});
	}

	protected send(): void {
		if (!this.canSend()) return;
		const body = namesToTokens(this.text.trim(), this.picked);
		const mentionEmployeeIds = [...new Set([...this.picked.values()].filter((id) => body.includes(`<@${id}>`)))];
		this.submitted.emit({ body, mentionEmployeeIds });
	}
}
