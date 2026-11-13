import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CHAT_MESSAGE_MAX_ATTACHMENTS, CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import {
	attachmentRoom,
	fileSizeLabel,
	filesOfTransfer,
	PendingAttachment,
	objectUrlOf,
	PreviewableFile,
	previewUrlOf,
	readyAttachmentIds,
	releaseObjectUrl,
	releasePreviews,
	uploadOutcome
} from '../../chat-attachments';
import { ChatEmoji, emojiQueryAt, replaceShortcodeBefore, suggestEmoji } from '../../chat-emoji';
import { CHAT_COMPOSER_EMOJI, CHAT_MENTION_SUGGESTIONS } from '../../chat-ui.constants';
import {
	apiErrorMessage,
	ChatMemberIds,
	markMentions,
	matchParts,
	mentionQueryAt,
	MentionSuggestion,
	namesToTokens,
	rankMentions,
	tokensToNames,
	uniqueLabel
} from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { FilePreviewComponent } from '../file-preview/file-preview.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What the composer hands over: the body with mention tokens, the employees it mentions, and the files it carries. */
export interface ComposerSubmission {
	body: string;
	mentionEmployeeIds: string[];
	/** The stored documents to attach (empty in edit mode: the files of a message stay as they are). */
	attachmentIds: string[];
}

/** How often a composer asks to tell the members that the person is typing (a little over the platform's own interval). */
export const CHAT_COMPOSER_TYPING_EVERY_MS = 3000;

/** The unsent text of each conversation and thread, kept while the page lives (a switch and back finds it again). */
const DRAFTS = new Map<string, string>();

/** Forgets the draft of a place (a send that landed after the person moved on). */
export function clearDraft(draftKey: string): void {
	DRAFTS.delete(draftKey);
}

/** A Markdown mark the formatting bar puts around the selection (or at the start of each selected line). */
type ComposerFormat = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list' | 'quote';

/** One row of the `@` list: a person, or `@channel` / `@here` (in a channel), with the part the query matched. */
type MentionChoice =
	| ({ kind: 'person'; key: string } & MentionSuggestion)
	| { kind: 'everyone'; key: 'channel' | 'here'; labelKey: string; parts: ReturnType<typeof matchParts> };

/** The `@` words that notify a whole channel, and what each one means. */
const EVERYONE_MENTIONS: readonly { key: 'channel' | 'here'; labelKey: string }[] = [
	{ key: 'channel', labelKey: 'CHAT.COMPOSER.MENTION_EVERYONE' },
	{ key: 'here', labelKey: 'CHAT.COMPOSER.MENTION_HERE' }
];

/** The text box grows with what is typed up to this height (px), then scrolls. */
const MAX_BOX_HEIGHT_PX = 240;

/** Gives each composer's suggestion list (`@` or `:`) its own id (a conversation and its thread show two composers at once). */
let nextComposerId = 0;

/**
 * The text box of a conversation or a thread, framed as chat apps do: a formatting bar (bold, italic, strike,
 * code, link, list, quote: the Markdown the API stores), the box (it grows with its text), and a bottom bar with
 * the attach, emoji and mention buttons and the send button. Enter sends, Shift+Enter breaks the line, `@` opens the
 * people suggestions and `:` the emoji ones (arrows, Enter, Escape; a complete `:name:` becomes its emoji as it is
 * typed). In edit mode it starts with the message's text and offers Save / Cancel. Mentions show as `@Name`
 * (`#channel`) while writing and go out as tokens; each label stands for one id, so two people of one name never
 * swap. The length that counts is the tokenized body's, the one the API measures.
 *
 * Files (where the person may upload documents): picked with the paperclip, dropped on the composer, or pasted.
 * Each is stored at once through the Docs plugin as the sender's own private file, shown as a chip that can be
 * taken off, and goes out with the message; sending waits until every file is stored. A message of files alone
 * carries their names as its text (the platform needs one).
 */
@Component({
	selector: 'ngx-chat-message-composer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(document:mousedown)': 'onDocumentPress($event)'
	},
	imports: [FormsModule, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent, FilePreviewComponent],
	template: `
		<div
			class="composer"
			data-test="composer"
			[class.editing]="editing()"
			[class.dragging]="dragging()"
			(keydown.escape)="onComposerEscape($event)"
			(dragover)="onDragOver($event)"
			(dragleave)="onDragLeave($event)"
			(drop)="onDrop($event)"
		>
			@if (emojiSuggestions().length > 0 && suggestions().length === 0) {
				<div class="composer-popover suggestions" data-test="emoji-suggestions">
					<ul class="suggestion-list" role="listbox" [id]="listId" [attr.aria-label]="'CHAT.COMPOSER.EMOJI_SUGGESTIONS' | translate">
						@for (emoji of emojiSuggestions(); track emoji.code; let index = $index) {
							<li
								class="option"
								role="option"
								[id]="optionId(index)"
								[attr.data-index]="index"
								[attr.aria-selected]="index === highlighted()"
								[class.highlighted]="index === highlighted()"
								(mouseenter)="highlighted.set(index)"
								(mousedown)="$event.preventDefault(); pickEmoji(emoji)"
							>
								<span class="emoji-glyph" aria-hidden="true">{{ emoji.emoji }}</span>
								<span class="option-name">:{{ emoji.code }}:</span>
								@if (index === highlighted()) {
									<kbd class="option-key" aria-hidden="true">↵</kbd>
								}
							</li>
						}
					</ul>
					<div class="suggestion-hint" aria-hidden="true">
						<span><kbd>↑</kbd><kbd>↓</kbd> {{ 'CHAT.COMPOSER.KEY_NAVIGATE' | translate }}</span>
						<span><kbd>Tab</kbd> / <kbd>↵</kbd> {{ 'CHAT.COMPOSER.KEY_SELECT' | translate }}</span>
						<span><kbd>Esc</kbd> {{ 'CHAT.COMPOSER.KEY_DISMISS' | translate }}</span>
					</div>
				</div>
			}
			@if (suggestions().length > 0) {
				<div class="composer-popover suggestions" data-test="mention-suggestions">
					<ul class="suggestion-list" role="listbox" [id]="listId" [attr.aria-label]="'CHAT.COMPOSER.MENTION_SUGGESTIONS' | translate">
						@for (choice of suggestions(); track choice.key; let index = $index) {
							@if (choice.kind === 'person' && index === 0) {
								<li class="group" role="presentation">{{ 'CHAT.COMPOSER.PEOPLE' | translate }}</li>
							}
							@if (choice.kind === 'everyone' && (index === 0 || suggestions()[index - 1].kind === 'person')) {
								<li class="group" role="presentation">{{ 'CHAT.COMPOSER.NOTIFY' | translate }}</li>
							}
							<li
								class="option"
								role="option"
								[id]="optionId(index)"
								[attr.data-index]="index"
								[attr.aria-selected]="index === highlighted()"
								[class.highlighted]="index === highlighted()"
								[class.outside]="choice.kind === 'person' && choice.member === false"
								(mouseenter)="highlighted.set(index)"
								(mousedown)="$event.preventDefault(); pick(choice)"
							>
								@if (choice.kind === 'person') {
									<ngx-chat-person-avatar [person]="choice.person" size="small"></ngx-chat-person-avatar>
								} @else {
									<span class="everyone-icon" aria-hidden="true">&#64;</span>
								}
								<span class="option-name">{{ choice.parts.before }}<mark>{{ choice.parts.match }}</mark>{{ choice.parts.after }}</span>
								@if (choice.kind === 'everyone') {
									<span class="option-detail">{{ choice.labelKey | translate }}</span>
								} @else if (choice.isMe) {
									<span class="option-detail">{{ 'CHAT.COMPOSER.YOU' | translate }}</span>
								} @else if (choice.member === false) {
									<span class="option-detail">{{ 'CHAT.COMPOSER.NOT_MEMBER' | translate }}</span>
								}
								@if (index === highlighted()) {
									<kbd class="option-key" aria-hidden="true">↵</kbd>
								}
							</li>
						}
					</ul>
					<div class="suggestion-hint" aria-hidden="true">
						<span><kbd>↑</kbd><kbd>↓</kbd> {{ 'CHAT.COMPOSER.KEY_NAVIGATE' | translate }}</span>
						<span><kbd>Tab</kbd> / <kbd>↵</kbd> {{ 'CHAT.COMPOSER.KEY_SELECT' | translate }}</span>
						<span><kbd>Esc</kbd> {{ 'CHAT.COMPOSER.KEY_DISMISS' | translate }}</span>
					</div>
				</div>
			}
			@if (emojiOpen()) {
				<div class="composer-popover emoji-grid" role="menu" data-test="composer-emoji">
					@for (emoji of emojiChoices; track emoji) {
						<button type="button" class="emoji" role="menuitem" [attr.aria-label]="emoji" (mousedown)="$event.preventDefault()" (click)="insertEmoji(emoji)">{{ emoji }}</button>
					}
				</div>
			}
			@if (editing()) {
				<div class="edit-banner">
					<nb-icon icon="edit-outline"></nb-icon>
					<strong>{{ 'CHAT.COMPOSER.EDITING' | translate }}</strong>
					<span class="edit-hint">{{ 'CHAT.COMPOSER.EDITING_HINT' | translate }}</span>
				</div>
			}
			<div class="frame" [class.focused]="focused()" [class.disabled]="disabled()" [class.over]="isTooLong()">
				<div class="format-bar" role="toolbar">
					@for (tool of formats; track tool.format) {
						<button
							type="button"
							class="tool"
							[disabled]="disabled()"
							[nbTooltip]="tool.labelKey | translate"
							[attr.aria-label]="tool.labelKey | translate"
							(mousedown)="$event.preventDefault()"
							(click)="format(tool.format)"
						>
							@if (tool.icon) {
								<nb-icon [icon]="tool.icon"></nb-icon>
							} @else {
								<span class="glyph" [class]="'glyph-' + tool.format">{{ tool.glyph }}</span>
							}
						</button>
						@if (tool.divider) {
							<span class="divider"></span>
						}
					}
				</div>
				<div class="box-wrap">
					<!-- Under the (transparent) box, the same text with each mention tinted where it sits. -->
					<!-- Each run sits alone in its span: whitespace around an interpolation would shift the text. -->
					<div #mirror class="box mirror" aria-hidden="true">
						@for (part of marked(); track $index) {
							<span [class.mention-mark]="part.mention">{{ part.text }}</span>
						}
					</div>
				<textarea
					#box
					rows="1"
					class="box"
					data-test="composer-box"
					[placeholder]="placeholder()"
					[disabled]="disabled()"
					[attr.aria-label]="placeholder()"
					role="combobox"
					aria-autocomplete="list"
					[attr.aria-expanded]="listOpen()"
					[attr.aria-controls]="listOpen() ? listId : null"
					[attr.aria-activedescendant]="listOpen() ? optionId(highlighted()) : null"
					[attr.maxlength]="max"
					[(ngModel)]="text"
					(ngModelChange)="onInput()"
					(keydown)="onKeyDown($event)"
					(keyup)="onCaretMove()"
					(click)="onCaretMove()"
					(focus)="focused.set(true)"
					(blur)="focused.set(false)"
					(scroll)="syncMirror()"
					(paste)="onPaste($event)"
				></textarea>
				</div>
				@if (attachments().length > 0 && !editing()) {
					<ul class="attachments" data-test="composer-attachments">
						@for (item of attachments(); track item.key) {
							<!-- A picture that is stored (or on its way) shows as itself; any other file, and a refused one, as a card. -->
							@let tile = !!item.previewUrl && item.status !== 'failed';
							<li
								class="attachment"
								[class.tile]="tile"
								[class.failed]="item.status === 'failed'"
								[attr.data-status]="item.status"
								[attr.title]="item.name"
							>
								<!-- The whole file is a button: a press shows it in the preview popup. -->
								<button
									type="button"
									class="attachment-open"
									data-test="composer-attachment-open"
									[attr.aria-label]="'CHAT.COMPOSER.PREVIEW_FILE' | translate: { name: item.name }"
									(click)="openPreview(item)"
								></button>
								@if (item.previewUrl) {
									<img class="attachment-thumb" [src]="item.previewUrl" [alt]="item.name" />
								} @else {
									<span class="attachment-icon" aria-hidden="true">
										<nb-icon [icon]="item.status === 'failed' ? 'alert-circle-outline' : 'file-text-outline'"></nb-icon>
									</span>
								}
								@if (!tile) {
									<span class="attachment-text">
										<span class="attachment-name">{{ item.name }}</span>
										@if (item.status === 'uploading') {
											<span class="attachment-meta">{{ 'CHAT.COMPOSER.UPLOADING' | translate }}</span>
										} @else if (item.status === 'failed') {
											<span class="attachment-meta">{{ item.error ?? 'CHAT.COMPOSER.UPLOAD_FAILED' | translate }}</span>
										} @else {
											<span class="attachment-meta">{{ size(item.size) }}</span>
										}
									</span>
								}
								@if (item.status === 'uploading') {
									<span class="attachment-busy" role="status" [attr.aria-label]="'CHAT.COMPOSER.UPLOADING' | translate"></span>
								}
								<button type="button" class="attachment-remove" [attr.aria-label]="'CHAT.COMPOSER.REMOVE_FILE' | translate: { name: item.name }" (click)="removeAttachment(item.key)">
									<nb-icon icon="close-outline"></nb-icon>
								</button>
							</li>
						}
					</ul>
				}
				@if (preview(); as shown) {
					<ngx-chat-file-preview [file]="shown" (closed)="closePreview()"></ngx-chat-file-preview>
				}
				<div class="bottom-bar">
					@if (canAttach() && !editing()) {
						<input #picker type="file" multiple hidden data-test="composer-file-input" (change)="onPicked($event)" />
						<button
							type="button"
							class="tool"
							data-test="composer-attach"
							[disabled]="disabled() || room() === 0"
							[nbTooltip]="'CHAT.COMPOSER.ATTACH' | translate"
							[attr.aria-label]="'CHAT.COMPOSER.ATTACH' | translate"
							(mousedown)="$event.preventDefault()"
							(click)="picker.click()"
						>
							<nb-icon icon="attach-outline"></nb-icon>
						</button>
					}
					<button
						type="button"
						class="tool"
						[class.on]="emojiOpen()"
						[disabled]="disabled()"
						[nbTooltip]="'CHAT.COMPOSER.EMOJI' | translate"
						[attr.aria-label]="'CHAT.COMPOSER.EMOJI' | translate"
						[attr.aria-expanded]="emojiOpen()"
						(mousedown)="$event.preventDefault()"
						(click)="toggleEmoji($event)"
					>
						<nb-icon icon="smiling-face-outline"></nb-icon>
					</button>
					<button
						type="button"
						class="tool at"
						[disabled]="disabled()"
						[nbTooltip]="'CHAT.COMPOSER.MENTION' | translate"
						[attr.aria-label]="'CHAT.COMPOSER.MENTION' | translate"
						(mousedown)="$event.preventDefault()"
						(click)="startMention()"
					>
						&#64;
					</button>
					<span class="spacer"></span>
					@if (isTooLong()) {
						<span class="counter over">{{ length() }} / {{ max }}</span>
					}
					@if (editing()) {
						<button type="button" class="text-button" data-test="composer-cancel" (click)="editCancelled.emit()">{{ 'CHAT.COMPOSER.CANCEL' | translate }}</button>
						<button type="button" class="text-button primary" data-test="composer-send" [disabled]="!canSend()" (click)="send()">{{ 'CHAT.COMPOSER.SAVE' | translate }}</button>
					} @else {
						<button
							type="button"
							class="send"
							data-test="composer-send"
							[class.ready]="canSend()"
							[disabled]="!canSend()"
							[nbTooltip]="'CHAT.COMPOSER.SEND' | translate"
							[attr.aria-label]="'CHAT.COMPOSER.SEND' | translate"
							(click)="send()"
						>
							<nb-icon icon="paper-plane-outline"></nb-icon>
							<span class="send-label">{{ 'CHAT.COMPOSER.SEND' | translate }}</span>
						</button>
					}
				</div>
			</div>
			<div class="hint" [class.over]="isTooLong() || skippedFiles() > 0" aria-live="polite">
				@if (isTooLong()) {
					{{ 'CHAT.COMPOSER.TOO_LONG' | translate: { max: max } }}
				} @else if (skippedFiles() > 0) {
					{{ 'CHAT.COMPOSER.TOO_MANY_FILES' | translate: { max: maxFiles, count: skippedFiles() } }}
				} @else {
					{{ 'CHAT.COMPOSER.HINT' | translate }}
				}
			</div>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.composer {
				position: relative;
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}
			.edit-banner {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				padding: 0 0.25rem;
				color: var(--chat-accent, #3366ff);
				font-size: 0.6875rem;
			}
			.edit-hint {
				color: var(--chat-muted, inherit);
			}
			.frame {
				display: flex;
				flex-direction: column;
				border: 1px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				border-radius: 0.5rem;
				background: var(--chat-bg, transparent);
				transition: border-color 0.12s ease, box-shadow 0.12s ease;
			}
			.frame.focused {
				border-color: var(--chat-text-soft, rgba(127, 127, 127, 0.7));
				box-shadow: 0 0.0625rem 0.375rem rgba(0, 0, 0, 0.08);
			}
			.composer.dragging .frame {
				outline: 2px dashed var(--chat-accent, var(--color-primary-default, #3366ff));
				outline-offset: 2px;
			}
			.composer.editing .frame {
				border-color: var(--chat-accent, #3366ff);
			}
			.frame.over {
				border-color: var(--chat-danger, #e4493f);
			}
			.frame.disabled {
				opacity: 0.7;
			}
			.format-bar,
			.bottom-bar {
				display: flex;
				align-items: center;
				gap: 0.125rem;
				padding: 0.25rem 0.375rem;
			}
			.format-bar {
				border-radius: 0.5rem 0.5rem 0 0;
				background: var(--chat-composer-bar, rgba(127, 127, 127, 0.05));
			}
			.divider {
				width: 1px;
				height: 1.125rem;
				margin: 0 0.25rem;
				background: var(--chat-border, rgba(127, 127, 127, 0.3));
			}
			.box-wrap {
				position: relative;
			}
			.box {
				position: relative;
				display: block;
				box-sizing: border-box;
				width: 100%;
				min-height: 2.5rem;
				max-height: 15rem;
				margin: 0;
				padding: 0.5rem 0.75rem;
				border: 0;
				outline: 0;
				resize: none;
				overflow-y: auto;
				/* The same gutter on the box and its layer, so both wrap their lines at the same width. */
				scrollbar-gutter: stable;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.875rem;
				line-height: 1.4667;
				letter-spacing: normal;
				word-spacing: normal;
				white-space: pre-wrap;
				overflow-wrap: break-word;
			}
			/* Same box metrics as the textarea, under it; only the mentions' tint shows. */
			.mirror {
				position: absolute;
				inset: 0;
				max-height: none;
				overflow: hidden;
				color: transparent;
				pointer-events: none;
				user-select: none;
			}
			.mention-mark {
				border-radius: 0.1875rem;
				background: var(--chat-mention-chip-bg, rgba(29, 155, 209, 0.16));
				box-shadow: 0 0 0 0.0625rem var(--chat-mention-chip-bg, rgba(29, 155, 209, 0.16));
			}
			.box::placeholder {
				color: var(--chat-muted, rgba(127, 127, 127, 0.9));
			}
			.tool {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				font: inherit;
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.tool nb-icon {
				font-size: 1rem;
			}
			.tool.at {
				font-size: 1rem;
				font-weight: 700;
			}
			.glyph {
				font-size: 0.9375rem;
				line-height: 1;
			}
			.glyph-bold {
				font-weight: 800;
			}
			.glyph-italic {
				font-family: Georgia, 'Times New Roman', serif;
				font-style: italic;
				font-weight: 600;
			}
			.glyph-strike {
				text-decoration: line-through;
				font-weight: 600;
			}
			.glyph-quote {
				font-size: 1.125rem;
			}
			.tool:hover:not(:disabled),
			.tool:focus-visible,
			.tool.on {
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text, inherit);
			}
			.tool:disabled {
				cursor: default;
				opacity: 0.5;
			}
			.spacer {
				flex: 1 1 auto;
			}
			.counter {
				margin-right: 0.5rem;
				font-size: 0.6875rem;
				font-weight: 600;
			}
			.counter.over {
				color: var(--chat-danger, #e4493f);
			}
			/* Always in sight: a soft grey button while there is nothing to send, filled once there is. */
			.send {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				gap: 0.375rem;
				height: 2rem;
				margin-left: 0.25rem;
				padding: 0 0.75rem;
				border: 0;
				border-radius: 0.375rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text-soft, inherit);
				font: inherit;
				font-size: 0.8125rem;
				font-weight: 600;
				cursor: pointer;
				transition: background-color 0.12s ease, color 0.12s ease, filter 0.12s ease;
			}
			.send nb-icon {
				font-size: 1rem;
			}
			.send.ready {
				background: var(--chat-send, #007a5a);
				color: var(--chat-on-accent, #fff);
			}
			.send.ready:hover,
			.send.ready:focus-visible {
				filter: brightness(1.08);
			}
			.send:disabled {
				cursor: default;
				color: var(--chat-muted, inherit);
			}
			.text-button {
				height: 1.75rem;
				margin-left: 0.25rem;
				padding: 0 0.75rem;
				border: 1px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				cursor: pointer;
			}
			.text-button:hover:not(:disabled) {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.text-button.primary {
				border-color: transparent;
				background: var(--chat-send, #007a5a);
				color: var(--chat-on-accent, #fff);
			}
			.text-button:disabled {
				cursor: default;
				opacity: 0.5;
			}
			.hint {
				min-height: 1rem;
				padding: 0 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.625rem;
				text-align: right;
			}
			.hint.over {
				color: var(--chat-danger, #e4493f);
			}
			/* Not \`.popover\`: the app's global Bootstrap \`.popover\` (top: 0, max-width: 276px) squashed these panels. */
			.composer-popover {
				position: absolute;
				top: auto;
				bottom: calc(100% + 0.25rem);
				left: 0;
				z-index: 20;
				box-sizing: border-box;
				max-width: none;
				margin: 0;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.5rem;
				background: var(--chat-raised, #fff);
				box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
			}
			.suggestions {
				width: min(22rem, 100%);
				overflow: hidden;
			}
			.suggestion-list {
				max-height: 17rem;
				overflow-y: auto;
				margin: 0;
				padding: 0.25rem;
				list-style: none;
				scrollbar-width: thin;
				scrollbar-color: var(--chat-border-strong, rgba(127, 127, 127, 0.35)) transparent;
			}
			.suggestion-list::-webkit-scrollbar {
				width: 0.375rem;
			}
			.suggestion-list::-webkit-scrollbar-thumb {
				border-radius: 1rem;
				background: var(--chat-border-strong, rgba(127, 127, 127, 0.35));
			}
			.suggestion-hint {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem 0.875rem;
				padding: 0.375rem 0.75rem;
				border-top: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				background: var(--chat-composer-bar, rgba(127, 127, 127, 0.05));
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
			}
			.suggestion-hint kbd,
			.option-key {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.125rem;
				height: 1.125rem;
				margin-right: 0.125rem;
				padding: 0 0.25rem;
				border: 1px solid var(--chat-border-strong, rgba(127, 127, 127, 0.35));
				border-radius: 0.25rem;
				background: transparent;
				box-shadow: none;
				color: var(--chat-text-soft, inherit);
				font-family: inherit;
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1;
			}
			.option-key {
				margin: 0 0 0 auto;
				flex: 0 0 auto;
			}
			.group {
				padding: 0.5rem 0.5rem 0.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
				font-weight: 600;
				letter-spacing: 0.02em;
				cursor: default;
			}
			.group:not(:first-child) {
				margin-top: 0.25rem;
				border-top: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
			}
			.option {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-height: 2rem;
				padding: 0.25rem 0.5rem;
				border-radius: 0.375rem;
				color: var(--chat-text, inherit);
				font-size: 0.8125rem;
				cursor: pointer;
			}
			/* One highlighted row (the mouse moves it too), in the same soft tint as the sidebar's hover and active rows. */
			.option.highlighted {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.option-name {
				overflow: hidden;
				font-weight: 400;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.option-name mark {
				padding: 0;
				background: transparent;
				color: inherit;
				font-weight: 700;
			}
			/* Not in the conversation: still pickable, a step quieter. */
			.option.outside ngx-chat-person-avatar,
			.option.outside .option-name {
				opacity: 0.7;
			}
			.option-detail {
				flex: 0 1 auto;
				overflow: hidden;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.everyone-icon {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				border-radius: 0.375rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text-soft, inherit);
				font-size: 0.8125rem;
				font-weight: 700;
			}
			.emoji-glyph {
				flex: 0 0 auto;
				width: 1.5rem;
				text-align: center;
				font-size: 1.125rem;
			}
			/* The files of the next message: a picture as itself, any other file as a card; each with a way to take it off. */
			.attachments {
				display: flex;
				flex-wrap: wrap;
				gap: 0.625rem;
				margin: 0;
				padding: 0.5rem 0.75rem 0.5rem;
				list-style: none;
			}
			.attachment {
				position: relative;
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				box-sizing: border-box;
				height: 3.5rem;
				max-width: min(16rem, 100%);
				padding: 0.375rem 0.75rem 0.375rem 0.375rem;
				border: 1px solid var(--chat-border, var(--border-basic-color-3, rgba(127, 127, 127, 0.3)));
				border-radius: 0.5rem;
				background: var(--chat-composer-bar, var(--background-basic-color-1, transparent));
				color: var(--chat-text, inherit);
				font-size: 0.75rem;
			}
			/* Covers the file (under its remove button): the press that opens its preview. */
			.attachment-open {
				position: absolute;
				inset: 0;
				padding: 0;
				border: 0;
				border-radius: inherit;
				background: transparent;
				cursor: pointer;
			}
			.attachment-open:hover,
			.attachment-open:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.attachment.tile {
				width: 3.5rem;
				padding: 0;
			}
			.attachment.failed {
				border-color: var(--chat-danger, var(--color-danger-default, #e4493f));
			}
			.attachment-thumb,
			.attachment-icon {
				flex: 0 0 auto;
				width: 2.625rem;
				height: 2.625rem;
				border-radius: 0.375rem;
			}
			.attachment-thumb {
				object-fit: cover;
			}
			.attachment.tile .attachment-thumb {
				width: 100%;
				height: 100%;
				border-radius: calc(0.5rem - 1px);
			}
			.attachment[data-status='uploading'] .attachment-thumb {
				opacity: 0.45;
			}
			.attachment-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				background: var(--chat-hover, var(--background-basic-color-3, rgba(127, 127, 127, 0.15)));
				color: var(--chat-text-soft, inherit);
				font-size: 1.25rem;
			}
			.attachment.failed .attachment-icon {
				color: var(--chat-danger, var(--color-danger-default, #e4493f));
			}
			.attachment-text {
				display: flex;
				flex-direction: column;
				min-width: 0;
				line-height: 1.125rem;
			}
			.attachment-name {
				overflow: hidden;
				font-weight: 600;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.attachment-meta {
				overflow: hidden;
				color: var(--chat-muted, var(--text-hint-color, inherit));
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.attachment.failed .attachment-meta {
				color: var(--chat-danger, var(--color-danger-default, #e4493f));
			}
			/* A file on its way: a small turning ring, over the picture or at the end of the card. */
			.attachment-busy {
				flex: 0 0 auto;
				box-sizing: border-box;
				width: 1rem;
				height: 1rem;
				border: 2px solid var(--chat-border, rgba(127, 127, 127, 0.35));
				border-top-color: var(--chat-text, currentColor);
				border-radius: 50%;
				animation: attachment-turn 0.8s linear infinite;
			}
			.attachment.tile .attachment-busy {
				position: absolute;
				top: calc(50% - 0.5rem);
				left: calc(50% - 0.5rem);
			}
			@keyframes attachment-turn {
				to {
					transform: rotate(360deg);
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.attachment-busy {
					animation-duration: 2.4s;
				}
			}
			.attachment-remove {
				position: absolute;
				top: -0.4375rem;
				right: -0.4375rem;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.25rem;
				height: 1.25rem;
				padding: 0;
				border: 1px solid var(--chat-border, var(--border-basic-color-3, rgba(127, 127, 127, 0.3)));
				border-radius: 50%;
				background: var(--chat-raised, var(--background-basic-color-1, Canvas));
				color: var(--chat-text, inherit);
				font-size: 0.75rem;
				cursor: pointer;
			}
			.attachment-remove:hover,
			.attachment-remove:focus-visible {
				background: var(--chat-hover, var(--background-basic-color-3, rgba(127, 127, 127, 0.15)));
			}
			.emoji-grid {
				display: grid;
				grid-template-columns: repeat(8, 2.25rem);
				gap: 0.125rem;
				padding: 0.375rem;
			}
			.emoji {
				width: 2.25rem;
				height: 2.25rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				font-size: 1.25rem;
				cursor: pointer;
				transition: transform 0.08s ease, background-color 0.08s ease;
			}
			.emoji:hover,
			.emoji:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				transform: scale(1.12);
			}
			@media (max-width: 600px) {
				/* The usual hint goes on a phone; a warning (too long, files left out) stays. */
				.hint:not(.over) {
					display: none;
				}
				.send {
					padding: 0 0.625rem;
				}
				.send-label {
					display: none;
				}
				.emoji-grid {
					grid-template-columns: repeat(6, 2.25rem);
				}
			}
		`
	]
})
export class MessageComposerComponent {
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);

	readonly people = input.required<ChatPeople>();
	readonly conversationNames = input<ReadonlyMap<string, string>>(new Map());
	readonly placeholder = input('');
	readonly disabled = input(false);
	/** Whether `@channel` and `@here` are offered (in a channel and its threads). */
	readonly everyone = input(false);
	/** The conversation's members: they come first in the `@` list, the ones known to be outside it say so. */
	readonly memberIds = input<ChatMemberIds | null>(null);
	/** Me, marked "you" and ranked after the others in the `@` list. */
	readonly meEmployeeId = input<string | null>(null);
	/** The message being edited (its body with tokens), or null for a new message. */
	readonly initialBody = input<string | null>(null);
	readonly editing = input(false);
	/** Where the unsent text belongs (a conversation, a thread): it is kept per key and found again on return. */
	readonly draftKey = input<string | null>(null);
	/** Clears the box (and the draft of the key) after this submission counter changes (the parent sent it). */
	readonly resetToken = input(0);
	/** Whether the person may attach files (`DOCS_CREATE`: they are stored as documents). */
	readonly canAttach = input(false);
	/** In edit mode: the message keeps files, so its text may be emptied (the platform takes a message of files only). */
	readonly keepsFiles = input(false);

	readonly submitted = output<ComposerSubmission>();
	/**
	 * The person is typing (text changed by them, the box not empty): at most once per
	 * {@link CHAT_COMPOSER_TYPING_EVERY_MS}, so the place tells the other members while it lasts. Never in edit mode.
	 */
	readonly typing = output<void>();
	/** The person left edit mode without saving. */
	readonly editCancelled = output<void>();

	private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');
	private readonly mirror = viewChild<ElementRef<HTMLDivElement>>('mirror');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	/** The open suggestion list's id (`@` or `:`); each option's is this plus its index (the box points at the highlighted one). */
	protected readonly listId = `chat-composer-suggestions-${++nextComposerId}`;
	protected text = '';
	/** `@label` → employee id and `#label` → conversation id, as shown in the box. */
	private picked = new Map<string, string>();
	private channels = new Map<string, string>();
	/** Whether the person typed since the box was last filled (a late people list must not overwrite that). */
	private dirty = false;
	private lastReset = 0;
	private filledKey: string | null = null;
	protected readonly length = signal(0);
	protected readonly query = signal<{ query: string; start: number } | null>(null);
	protected readonly highlighted = signal(0);
	/** The `:` query under the caret (only when no `@` query is open). */
	protected readonly emojiQuery = signal<{ query: string; start: number } | null>(null);
	protected readonly attachments = signal<PendingAttachment[]>([]);
	/** The waiting file shown in the preview popup. */
	protected readonly preview = signal<PreviewableFile | null>(null);
	/** How many files of the last pick, drop or paste did not fit the message (it holds {@link maxFiles}). */
	protected readonly skippedFiles = signal(0);
	protected readonly maxFiles = CHAT_MESSAGE_MAX_ATTACHMENTS;
	protected readonly dragging = signal(false);
	private readonly uploads = new Map<number, Subscription>();
	private nextKey = 0;
	/** The documents of the last send: a message carries them (or will), so they are never discarded as drafts. */
	private submittedDocumentIds = new Set<string>();
	/**
	 * The documents of the send under way, and the place it was made in: protected until the place answers it (cleared on
	 * success, freed on a refusal). A person who moves on meanwhile leaves them protected: that send may still land.
	 */
	private inFlightDocumentIds: { ids: string[]; key: string | null } | null = null;
	/** When the last typing signal was asked for. */
	private lastTyping = 0;
	/**
	 * Where Escape closed the suggestions: they stay closed while the text and the caret are as they were then (the
	 * Escape's own keyup, a click on the same spot), and open again once either changes.
	 */
	private dismissed: { text: string; caret: number } | null = null;
	protected readonly focused = signal(false);
	protected readonly emojiOpen = signal(false);
	/** The box's text cut into plain runs and mentions, for the tinted layer under it. */
	protected readonly marked = signal<{ text: string; mention: boolean }[]>([]);

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	protected readonly emojiChoices = CHAT_COMPOSER_EMOJI;
	/** The formatting bar: an Eva icon where the set has one, a styled letter (`glyph`) where it has none. */
	protected readonly formats: readonly { format: ComposerFormat; icon?: string; glyph?: string; labelKey: string; divider?: boolean }[] = [
		{ format: 'bold', glyph: 'B', labelKey: 'CHAT.COMPOSER.BOLD' },
		{ format: 'italic', glyph: 'I', labelKey: 'CHAT.COMPOSER.ITALIC' },
		{ format: 'strike', glyph: 'S', labelKey: 'CHAT.COMPOSER.STRIKE', divider: true },
		{ format: 'link', icon: 'link-2-outline', labelKey: 'CHAT.COMPOSER.LINK', divider: true },
		{ format: 'list', icon: 'list-outline', labelKey: 'CHAT.COMPOSER.LIST' },
		{ format: 'quote', glyph: '❝', labelKey: 'CHAT.COMPOSER.QUOTE', divider: true },
		{ format: 'code', icon: 'code-outline', labelKey: 'CHAT.COMPOSER.CODE' }
	];

	/** People whose name matches the `@` query (the ones starting with it first), then `@channel` / `@here` in a channel. */
	protected readonly suggestions = computed<MentionChoice[]>(() => {
		const query = this.query();
		if (!query) return [];
		const people = rankMentions(this.people().list, query.query, {
			memberIds: this.memberIds(),
			meEmployeeId: this.meEmployeeId(),
			limit: CHAT_MENTION_SUGGESTIONS
		}).map((suggestion): MentionChoice => ({ kind: 'person', key: suggestion.person.employeeId, ...suggestion }));
		const needle = query.query.trim().toLowerCase();
		const everyone = this.everyone()
			? EVERYONE_MENTIONS.filter((item) => item.key.startsWith(needle)).map((item): MentionChoice => {
					const parts = matchParts(item.key, needle);
					return { kind: 'everyone', key: item.key, labelKey: item.labelKey, parts: { ...parts, before: `@${parts.before}` } };
				})
			: [];
		return [...people, ...everyone];
	});
	protected readonly emojiSuggestions = computed(() => {
		const query = this.emojiQuery();
		return query ? suggestEmoji(query.query, CHAT_MENTION_SUGGESTIONS) : ([] as ChatEmoji[]);
	});
	/** Whether a suggestion list is shown (the box is then a combobox that owns it). */
	protected readonly listOpen = computed(() => this.suggestions().length > 0 || this.emojiSuggestions().length > 0);
	protected readonly isTooLong = computed(() => this.length() > this.max);
	protected readonly uploading = computed(() => this.attachments().some((item) => item.status === 'uploading'));
	protected readonly room = computed(() => attachmentRoom(this.attachments()));
	protected readonly canSend = computed(() => {
		const editing = this.editing();
		const hasFiles = !editing && readyAttachmentIds(this.attachments()).length > 0;
		// A file that was not stored is taken off (or picked again) first: the message never goes out without it.
		const refused = !editing && this.attachments().some((item) => item.status === 'failed');
		const keepsFiles = editing && this.keepsFiles();
		return (this.length() > 0 || hasFiles || keepsFiles) && !this.isTooLong() && !this.disabled() && (editing || (!this.uploading() && !refused));
	});

	constructor() {
		// The box is filled when the edited message or the place changes: with the message's text, or the draft of the place.
		effect(() => {
			const initial = this.initialBody();
			const key = this.draftKey();
			untracked(() => {
				// The files picked belong to the place they were picked in: left there unsent, they are discarded.
				if (key !== this.filledKey) this.dropAttachments(true);
				this.filledKey = key;
				this.fill(initial, key);
			});
		});
		this.destroyRef.onDestroy(() => this.dropAttachments(true));
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
		// The place is busy while it sends (`disabled`). A send that ends without clearing the composer was refused: the
		// files it took are drafts again (taken off, or left behind, they are discarded); a send under way keeps them.
		effect(() => {
			const busy = this.disabled();
			untracked(() => {
				const inFlight = this.inFlightDocumentIds;
				if (busy || !inFlight) return;
				this.inFlightDocumentIds = null;
				// Another place now: the place stopped waiting for that send, it did not refuse it.
				if (inFlight.key !== this.draftKey()) return;
				for (const id of inFlight.ids) this.submittedDocumentIds.delete(id);
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
		this.emojiQuery.set(null);
		this.dismissed = null;
		this.measure();
		this.afterRender(() => this.autosize());
	}

	private clear(): void {
		this.text = '';
		this.picked = new Map();
		this.channels = new Map();
		this.dirty = false;
		const key = this.draftKey();
		if (key) DRAFTS.delete(key);
		this.length.set(0);
		this.marked.set([]);
		this.query.set(null);
		this.emojiQuery.set(null);
		this.emojiOpen.set(false);
		// The files went with the message that was sent: nothing to discard.
		this.dropAttachments(false);
		this.submittedDocumentIds = new Set();
		this.inFlightDocumentIds = null;
		this.afterRender(() => this.autosize());
	}

	/** Runs once the box shows the model's text (`ngModel` writes it a tick after a change). */
	private afterRender(task: () => void): void {
		setTimeout(task);
	}

	/** Grows the box with its text, up to its maximum height (then it scrolls). */
	private autosize(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		element.style.height = 'auto';
		element.style.height = `${Math.min(element.scrollHeight, MAX_BOX_HEIGHT_PX)}px`;
	}

	/** Puts text in place of a range of the box, then selects a range of the result (the caret when empty). */
	private replaceRange(from: number, to: number, insertion: string, selectFrom: number, selectTo: number): void {
		this.text = `${this.text.slice(0, from)}${insertion}${this.text.slice(to)}`;
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.afterRender(() => {
			const element = this.box()?.nativeElement;
			if (!element) return;
			element.focus();
			element.setSelectionRange(selectFrom, selectTo);
			this.autosize();
			this.onCaretMove();
		});
	}

	/** Wraps the selection in a Markdown mark (or prefixes each selected line, for a list or a quote; again to undo it). */
	protected format(kind: ComposerFormat): void {
		const element = this.box()?.nativeElement;
		if (!element || this.disabled()) return;
		const start = element.selectionStart ?? this.text.length;
		const end = element.selectionEnd ?? start;
		const selected = this.text.slice(start, end);
		if (kind === 'list' || kind === 'quote') {
			const prefix = kind === 'list' ? '- ' : '> ';
			// At the very start there is no line before (lastIndexOf with -1 would find a leading newline at 0).
			const lineStart = start === 0 ? 0 : this.text.lastIndexOf('\n', start - 1) + 1;
			const lines = this.text.slice(lineStart, end).split('\n');
			const undo = lines.every((line) => line.startsWith(prefix));
			const block = lines.map((line) => (undo ? line.slice(prefix.length) : `${prefix}${line}`)).join('\n');
			this.replaceRange(lineStart, end, block, lineStart + block.length, lineStart + block.length);
			return;
		}
		if (kind === 'link') {
			const insertion = `[${selected}](https://)`;
			const at = selected ? start + selected.length + 3 : start + 1;
			this.replaceRange(start, end, insertion, at, selected ? at + 8 : at);
			return;
		}
		if (kind === 'code' && selected.includes('\n')) {
			const fence = '```';
			const insertion = `${fence}\n${selected}\n${fence}`;
			this.replaceRange(start, end, insertion, start + 4, start + 4 + selected.length);
			return;
		}
		const mark = kind === 'bold' ? '**' : kind === 'italic' ? '_' : kind === 'strike' ? '~~' : '`';
		this.replaceRange(start, end, `${mark}${selected}${mark}`, start + mark.length, start + mark.length + selected.length);
	}

	protected insertEmoji(emoji: string): void {
		const element = this.box()?.nativeElement;
		const start = element?.selectionStart ?? this.text.length;
		const end = element?.selectionEnd ?? start;
		this.emojiOpen.set(false);
		this.replaceRange(start, end, emoji, start + emoji.length, start + emoji.length);
	}

	/** Types an `@` at the caret (after a space when needed), which opens the people suggestions. */
	protected startMention(): void {
		const element = this.box()?.nativeElement;
		const start = element?.selectionStart ?? this.text.length;
		const end = element?.selectionEnd ?? start;
		const before = this.text.slice(0, start);
		const insertion = before && !/\s$/.test(before) ? ' @' : '@';
		this.replaceRange(start, end, insertion, start + insertion.length, start + insertion.length);
	}

	/**
	 * Opens or closes the emoji panel. Opened from the keyboard (a click with no pointer: `detail` 0), the focus moves
	 * to its first emoji, since the panel sits above the box, far behind the toggle in Tab order; a mouse keeps the box's focus.
	 */
	protected toggleEmoji(event: MouseEvent): void {
		const open = !this.emojiOpen();
		// One panel at a time: the grid takes the place of an open `@` or `:` list (closed until the text or caret moves).
		if (open && this.listOpen()) this.dismiss();
		this.emojiOpen.set(open);
		if (open && event.detail === 0) this.afterRender(() => this.host.nativeElement.querySelector<HTMLElement>('.emoji-grid .emoji')?.focus());
	}

	/** Escape anywhere in the composer (the box, the emoji toggle, an emoji) closes the emoji panel and returns to the box. */
	protected onComposerEscape(event: Event): void {
		if (!this.emojiOpen()) return;
		event.preventDefault();
		this.emojiOpen.set(false);
		this.focus();
	}

	/** A press outside the composer closes its emoji panel. */
	protected onDocumentPress(event: MouseEvent): void {
		if (this.emojiOpen() && !this.host.nativeElement.contains(event.target as Node)) this.emojiOpen.set(false);
	}

	/** The body as the API would receive it, and its length (the one that counts). */
	private tokenized(): string {
		return namesToTokens(this.text.trim(), this.picked, this.channels);
	}

	private measure(): void {
		this.length.set(this.tokenized().length);
		const labels = [...[...this.picked.keys()].map((label) => `@${label}`), ...[...this.channels.keys()].map((label) => `#${label}`)];
		this.marked.set(markMentions(this.text, labels));
		this.afterRender(() => this.syncMirror());
	}

	/** Keeps the tinted layer scrolled with the box. */
	protected syncMirror(): void {
		const box = this.box()?.nativeElement;
		const mirror = this.mirror()?.nativeElement;
		if (box && mirror) mirror.scrollTop = box.scrollTop;
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
		this.replaceShortcode();
		this.measure();
		this.keepDraft();
		this.autosize();
		this.onCaretMove();
		this.signalTyping();
	}

	/** Asks the place to tell the members that the person is typing, at most once per interval. */
	private signalTyping(now = Date.now()): void {
		if (this.editing() || this.disabled() || !this.text.trim()) return;
		if (now - this.lastTyping < CHAT_COMPOSER_TYPING_EVERY_MS) return;
		this.lastTyping = now;
		this.typing.emit();
	}

	/** A complete `:name:` just typed becomes its emoji, the caret right after it. */
	private replaceShortcode(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		const replaced = replaceShortcodeBefore(this.text, element.selectionStart ?? this.text.length);
		if (!replaced) return;
		this.text = replaced.text;
		element.value = replaced.text;
		element.setSelectionRange(replaced.caret, replaced.caret);
	}

	protected onCaretMove(): void {
		const element = this.box()?.nativeElement;
		if (!element) return;
		const caret = element.selectionStart ?? this.text.length;
		if (this.dismissed && this.dismissed.text === this.text && this.dismissed.caret === caret) {
			this.query.set(null);
			this.emojiQuery.set(null);
			return;
		}
		this.dismissed = null;
		const next = mentionQueryAt(this.text, caret);
		const current = this.query();
		const emoji = next ? null : emojiQueryAt(this.text, caret);
		const currentEmoji = this.emojiQuery();
		if (next?.query !== current?.query || next?.start !== current?.start || emoji?.query !== currentEmoji?.query || emoji?.start !== currentEmoji?.start) {
			this.query.set(next);
			this.emojiQuery.set(emoji);
			this.highlighted.set(0);
			// A list that opens takes the place of the emoji grid.
			if (next || emoji) this.emojiOpen.set(false);
		}
	}

	protected onKeyDown(event: KeyboardEvent): void {
		// Keys that belong to an IME composition (Enter confirms it) neither pick a suggestion nor send.
		if (event.isComposing || event.keyCode === 229) return;
		const emojis = this.suggestions().length === 0 ? this.emojiSuggestions() : [];
		if (emojis.length > 0) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const step = event.key === 'ArrowDown' ? 1 : -1;
				this.highlighted.set((this.highlighted() + step + emojis.length) % emojis.length);
				this.afterRender(() => this.revealHighlighted());
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				this.pickEmoji(emojis[this.highlighted()] ?? emojis[0]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.dismiss();
				return;
			}
		}
		const suggestions = this.suggestions();
		if (suggestions.length > 0) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const step = event.key === 'ArrowDown' ? 1 : -1;
				this.highlighted.set((this.highlighted() + step + suggestions.length) % suggestions.length);
				this.afterRender(() => this.revealHighlighted());
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				// The list may have shrunk under the highlight (the people list changed): the first one then.
				this.pick(suggestions[this.highlighted()] ?? suggestions[0]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.dismiss();
				return;
			}
		}
		if (event.key === 'Escape' && this.emojiOpen()) {
			event.preventDefault();
			this.emojiOpen.set(false);
			return;
		}
		if (event.key === 'Escape' && this.editing()) {
			event.preventDefault();
			this.editCancelled.emit();
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.send();
		}
	}

	/** Scrolls the list so the row picked with the arrow keys stays in sight. */
	private revealHighlighted(): void {
		const row = this.host.nativeElement.querySelector(`.suggestion-list [data-index="${this.highlighted()}"]`);
		row?.scrollIntoView({ block: 'nearest' });
	}

	protected pick(choice: MentionChoice): void {
		const query = this.query();
		const element = this.box()?.nativeElement;
		if (!query || !element) return;
		const caret = element.selectionStart ?? this.text.length;
		let insertion: string;
		if (choice.kind === 'person') {
			const label = uniqueLabel(choice.person.name, choice.person.employeeId, this.picked);
			insertion = `@${label} `;
			this.picked.set(label, choice.person.employeeId);
		} else {
			insertion = `@${choice.key} `;
		}
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.query.set(null);
		const position = query.start + insertion.length;
		this.afterRender(() => {
			element.focus();
			element.setSelectionRange(position, position);
			this.autosize();
		});
	}

	protected optionId(index: number): string {
		return `${this.listId}-${index}`;
	}

	/** Closes the open suggestions until the text or the caret changes. */
	private dismiss(): void {
		const element = this.box()?.nativeElement;
		this.dismissed = { text: this.text, caret: element?.selectionStart ?? this.text.length };
		this.query.set(null);
		this.emojiQuery.set(null);
	}

	/** Puts the emoji in place of the `:` query and moves the caret after it. */
	protected pickEmoji(emoji: ChatEmoji): void {
		const query = this.emojiQuery();
		const element = this.box()?.nativeElement;
		if (!query || !element) return;
		const caret = element.selectionStart ?? this.text.length;
		const insertion = `${emoji.emoji} `;
		this.text = `${this.text.slice(0, query.start)}${insertion}${this.text.slice(caret)}`;
		this.dirty = true;
		this.measure();
		this.keepDraft();
		this.emojiQuery.set(null);
		const position = query.start + insertion.length;
		this.afterRender(() => {
			element.focus();
			element.setSelectionRange(position, position);
			this.autosize();
		});
	}

	protected send(): void {
		if (!this.canSend()) return;
		const editing = this.editing();
		const text = this.tokenized();
		const attachmentIds = editing ? [] : readyAttachmentIds(this.attachments());
		// A message of files only goes with an empty body: the platform takes it, and shows the files.
		const body = text;
		const mentionEmployeeIds = [...new Set([...this.picked.values()].filter((id) => body.includes(`<@${id}>`)))];
		for (const id of attachmentIds) this.submittedDocumentIds.add(id);
		this.inFlightDocumentIds = attachmentIds.length ? { ids: attachmentIds, key: this.draftKey() } : null;
		// Sent: the next keystroke tells the members again at once.
		this.lastTyping = 0;
		this.submitted.emit({ body, mentionEmployeeIds, attachmentIds });
	}

	// ---------------------------------------------------------------- files

	protected size(bytes: number): string {
		return fileSizeLabel(bytes);
	}

	protected onPicked(event: Event): void {
		const picker = event.target as HTMLInputElement | null;
		this.addFiles(Array.from(picker?.files ?? []));
		// The same file can be picked again after it was taken off.
		if (picker) picker.value = '';
	}

	protected onDragOver(event: DragEvent): void {
		if (!this.canAttach() || this.editing() || !Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
		event.preventDefault();
		this.dragging.set(true);
	}

	/** The drag left the composer itself: passing from one of its parts to another is not leaving it. */
	protected onDragLeave(event: DragEvent): void {
		const to = event.relatedTarget as Node | null;
		if (to && (event.currentTarget as Node | null)?.contains(to)) return;
		this.dragging.set(false);
	}

	protected onDrop(event: DragEvent): void {
		this.dragging.set(false);
		const files = filesOfTransfer(event.dataTransfer);
		if (!files.length || !this.canAttach() || this.editing()) return;
		event.preventDefault();
		this.addFiles(files);
	}

	/** A pasted picture (or file) is attached; pasted text is left to the box. */
	protected onPaste(event: ClipboardEvent): void {
		const files = filesOfTransfer(event.clipboardData);
		if (!files.length || !this.canAttach() || this.editing()) return;
		event.preventDefault();
		this.addFiles(files);
	}

	/** Stores each file at once (as many as the message can still take, the rest said), one request per file. */
	addFiles(files: readonly File[]): void {
		if (!this.canAttach() || this.editing() || this.disabled()) return;
		const room = this.room();
		this.skippedFiles.set(Math.max(0, files.length - room));
		for (const file of files.slice(0, room)) {
			this.nextKey += 1;
			const key = this.nextKey;
			this.attachments.update((list) => [
				...list,
				{ key, name: file.name || 'file', size: file.size, mimeType: file.type, status: 'uploading', documentId: null, error: null, previewUrl: previewUrlOf(file), file }
			]);
			const upload = this.api.uploadFile(file).subscribe({
				next: (answer) => {
					const outcome = uploadOutcome(answer);
					this.patchAttachment(key, 'documentId' in outcome ? { status: 'ready', documentId: outcome.documentId } : { status: 'failed', error: outcome.error });
				},
				error: (error: HttpErrorResponse) => {
					// No Docs plugin (or no right to upload) answers 404 / 403: attachments are not available here.
					const unavailable = error?.status === 404 || error?.status === 403;
					this.patchAttachment(key, {
						status: 'failed',
						error: unavailable ? 'CHAT.COMPOSER.ATTACH_UNAVAILABLE' : (apiErrorMessage(error) ?? 'CHAT.COMPOSER.UPLOAD_FAILED')
					});
				}
			});
			if (this.attachments().some((item) => item.key === key && item.status === 'uploading')) this.uploads.set(key, upload);
		}
	}

	/** Shows a waiting file in the preview popup, from the picked file itself. */
	protected openPreview(item: PendingAttachment): void {
		this.closePreview();
		const fileUrl = objectUrlOf(item.file);
		this.preview.set({ name: item.name, mimeType: item.mimeType, fileSize: item.size, fileUrl });
	}

	protected closePreview(): void {
		releaseObjectUrl(this.preview()?.fileUrl);
		this.preview.set(null);
	}

	protected removeAttachment(key: number): void {
		this.skippedFiles.set(0);
		this.uploads.get(key)?.unsubscribe();
		this.uploads.delete(key);
		const removed = this.attachments().find((item) => item.key === key);
		this.attachments.update((list) => list.filter((item) => item.key !== key));
		if (removed) {
			releasePreviews([removed]);
			this.discard([removed]);
		}
	}

	/**
	 * Tells the platform that stored files will not be sent (a draft upload): their documents and bytes go. A file a
	 * send took is never discarded; one still uploading is left to the platform's sweep of unsent uploads.
	 */
	private discard(items: readonly PendingAttachment[]): void {
		for (const item of items) {
			if (item.status !== 'ready' || !item.documentId || this.submittedDocumentIds.has(item.documentId)) continue;
			// Best effort: an older platform without the route answers 404, and the file stays as it did.
			this.api.discardAttachment(item.documentId).subscribe({ error: () => undefined });
		}
	}

	private patchAttachment(key: number, patch: Partial<PendingAttachment>): void {
		this.uploads.delete(key);
		this.attachments.update((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
	}

	/** Lets go of the files picked; `discard` when they are left unsent (another place, the composer gone). */
	private dropAttachments(discard: boolean): void {
		this.skippedFiles.set(0);
		for (const upload of this.uploads.values()) upload.unsubscribe();
		this.uploads.clear();
		if (discard) this.discard(this.attachments());
		this.closePreview();
		releasePreviews(this.attachments());
		if (this.attachments().length) this.attachments.set([]);
	}
}
