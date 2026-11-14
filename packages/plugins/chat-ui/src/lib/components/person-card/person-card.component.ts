import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, output, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CHAT_MESSAGE_MAX_LENGTH, ChatMemberRoleEnum } from '@gauzy/contracts';
import { ChatPerson, nameHue } from '../../chat-ui.helpers';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';
import { PresenceLabelComponent } from '../presence-label/presence-label.component';

/** How the person stands in the open conversation: their role and since when (null outside a conversation). */
export interface PersonCardMembership {
	role: ChatMemberRoleEnum | string;
	joinedAt: Date | string | null;
}

/**
 * A person's profile card, shown while the pointer rests on their avatar, their name or a mention of them: the
 * manner of a chat app's profile popout, and of the Teams dashboard's member card. A banner in the person's own
 * colour (the hue of their avatar), the photo over it, the name, their place in the open conversation, the
 * conversations we share, a box to message them directly, and a way to their full profile (with the right to see it).
 */
@Component({
	selector: 'ngx-chat-person-card',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent, PresenceLabelComponent],
	template: `
		@let who = person();
		<section class="profile" role="dialog" [attr.aria-label]="who.name" data-test="person-card">
			<div class="banner" [style.background]="banner()" aria-hidden="true"></div>
			@if (!isMe()) {
				<div class="banner-actions">
					<button
						type="button"
						class="banner-button"
						data-test="person-card-direct"
						[disabled]="sending()"
						[nbTooltip]="'CHAT.PROFILE.MESSAGE' | translate"
						[attr.aria-label]="'CHAT.PROFILE.MESSAGE' | translate"
						(click)="openDirect.emit()"
					>
						<nb-icon icon="message-circle-outline"></nb-icon>
					</button>
				</div>
			}
			<div class="photo">
				<ngx-chat-person-avatar [person]="who" size="large" [round]="true"></ngx-chat-person-avatar>
			</div>

			<div class="body">
				<div class="name-line">
					<span class="name" [attr.title]="who.name">{{ who.name }}</span>
					@if (isMe()) {
						<span class="chip">{{ 'CHAT.PROFILE.YOU' | translate }}</span>
					}
				</div>
				<ngx-chat-presence-label class="presence" [employeeId]="who.employeeId"></ngx-chat-presence-label>

				@if (membership(); as member) {
					<div class="meta">
						<span class="chip" [class.manager]="member.role === managerRole">
							{{ (member.role === managerRole ? 'CHAT.PROFILE.MANAGER' : 'CHAT.PROFILE.MEMBER') | translate }}
						</span>
						@if (member.joinedAt) {
							<span class="meta-text">{{ 'CHAT.PROFILE.JOINED' | translate: { date: (member.joinedAt | date: 'mediumDate') } }}</span>
						}
					</div>
				} @else if (inConversation() === false) {
					<div class="meta"><span class="meta-text">{{ 'CHAT.PROFILE.NOT_MEMBER' | translate }}</span></div>
				}

				@if (inCommon(); as count) {
					<div class="common">
						<nb-icon icon="people-outline"></nb-icon>
						{{ (count === 1 ? 'CHAT.PROFILE.IN_COMMON_ONE' : 'CHAT.PROFILE.IN_COMMON') | translate: { count: count } }}
					</div>
				}

				@if (!isMe() || canViewProfile()) {
					<div class="divider" role="separator"></div>
				}

				@if (!isMe()) {
					<input
						#quick
						type="text"
						class="quick"
						data-test="person-card-message"
						autocomplete="off"
						[attr.maxlength]="max"
						[disabled]="sending()"
						[placeholder]="'CHAT.PROFILE.MESSAGE_PLACEHOLDER' | translate: { name: who.name }"
						[attr.aria-label]="'CHAT.PROFILE.MESSAGE_PLACEHOLDER' | translate: { name: who.name }"
						(keydown.enter)="send($event)"
					/>
				}

				@if (canViewProfile()) {
					<a class="action" data-test="person-card-profile" [routerLink]="['/pages/employees/view', who.employeeId]">
						{{ 'CHAT.PROFILE.VIEW_PROFILE' | translate }}
						<nb-icon icon="arrow-forward-outline" aria-hidden="true"></nb-icon>
					</a>
				}
			</div>
		</section>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.profile {
				position: relative;
				width: 18.5rem;
				overflow: hidden;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.75rem;
				background: var(--chat-raised, var(--gauzy-card-1, #fff));
				box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.28);
				color: var(--chat-text, inherit);
			}
			.banner {
				height: 4.25rem;
			}
			.banner-actions {
				position: absolute;
				top: 0.5rem;
				right: 0.5rem;
				display: flex;
				gap: 0.25rem;
			}
			.banner-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border: 0;
				border-radius: 50%;
				background: rgba(0, 0, 0, 0.45);
				color: #fff;
				cursor: pointer;
				transition: background-color 0.12s ease;
			}
			.banner-button:hover:not(:disabled),
			.banner-button:focus-visible {
				background: rgba(0, 0, 0, 0.65);
			}
			.banner-button nb-icon {
				font-size: 1rem;
			}
			/* The photo overlaps the banner, ringed in the card's colour. */
			.photo {
				position: absolute;
				top: 1.875rem;
				left: 1rem;
				display: inline-flex;
				border-radius: 50%;
				box-shadow: 0 0 0 0.3125rem var(--chat-raised, var(--gauzy-card-1, #fff));
			}
			.body {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				padding: 2.875rem 1rem 1rem;
			}
			.presence {
				margin-top: 0.25rem;
			}
			.name-line {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-width: 0;
			}
			.name {
				overflow: hidden;
				font-size: 1.125rem;
				font-weight: 800;
				line-height: 1.5rem;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.meta {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.25rem 0.5rem;
			}
			.chip {
				flex: 0 0 auto;
				padding: 0.0625rem 0.4375rem;
				border-radius: 1rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.15));
				color: var(--chat-text-soft, inherit);
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1.125rem;
			}
			.chip.manager {
				background: var(--chat-accent-soft, rgba(127, 127, 127, 0.2));
				color: var(--chat-text, inherit);
			}
			.meta-text,
			.common {
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				line-height: 1rem;
			}
			.common {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}
			.common nb-icon {
				font-size: 0.875rem;
			}
			.divider {
				height: 1px;
				margin: 0.375rem 0 0.25rem;
				background: var(--chat-border, rgba(127, 127, 127, 0.2));
			}
			/* Global form styles reach a bare input: every property it shows is set here. */
			.quick {
				box-sizing: border-box;
				width: 100% !important;
				height: 2.25rem !important;
				margin: 0 !important;
				padding: 0 0.75rem !important;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25)) !important;
				border-radius: 0.5rem !important;
				outline: 0;
				background: var(--chat-bg, transparent) !important;
				box-shadow: none !important;
				color: var(--chat-text, inherit) !important;
				font: inherit;
				font-size: 0.8125rem !important;
			}
			.quick:focus {
				border-color: var(--chat-text-soft, rgba(127, 127, 127, 0.6)) !important;
			}
			.quick::placeholder {
				color: var(--chat-muted, rgba(127, 127, 127, 0.9));
			}
			.action {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				margin-top: 0.25rem;
				padding: 0.5rem 0.75rem;
				border-radius: 0.5rem;
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
				font-size: 0.8125rem;
				font-weight: 600;
				text-decoration: none;
				transition: background-color 0.12s ease;
			}
			.action:hover,
			.action:focus-visible {
				background: var(--chat-active-tint, rgba(127, 127, 127, 0.2));
				color: var(--chat-text, inherit);
				text-decoration: none;
			}
			.action nb-icon {
				font-size: 1rem;
				color: var(--chat-muted, inherit);
			}
		`
	]
})
export class PersonCardComponent {
	readonly person = input.required<ChatPerson>();
	readonly isMe = input(false);
	/** Their role in the open conversation and when they joined it, when they are in it. */
	readonly membership = input<PersonCardMembership | null>(null);
	/** Whether they are in the open conversation (null outside one, or when its members are not known). */
	readonly inConversation = input<boolean | null>(null);
	/** How many conversations we share (null when not known). */
	readonly inCommon = input<number | null>(null);
	/** Whether I may open their employee profile (`ORG_EMPLOYEES_VIEW`). */
	readonly canViewProfile = input(false);
	readonly sending = input(false);

	/** A message to send them directly (from the card's box). */
	readonly message = output<string>();
	/** Open our direct conversation. */
	readonly openDirect = output<void>();

	private readonly quick = viewChild<ElementRef<HTMLInputElement>>('quick');

	protected readonly max = CHAT_MESSAGE_MAX_LENGTH;
	protected readonly managerRole = ChatMemberRoleEnum.MANAGER;
	/** Their own colour: the hue of their avatar, as a soft two-tone banner. */
	protected readonly banner = computed(() => {
		const hue = nameHue(this.person().name);
		return `linear-gradient(135deg, hsl(${hue} 45% 40%), hsl(${(hue + 40) % 360} 42% 28%))`;
	});

	private readonly personId = computed(() => this.person().employeeId);
	/** The person the box's draft was typed for. */
	private draftFor: string | null = null;

	constructor() {
		// A draft belongs to the person it was typed for: the box empties whenever the card shows someone else.
		effect(() => {
			const id = this.personId();
			untracked(() => this.keepDraftFor(id));
		});
	}

	private keepDraftFor(employeeId: string): void {
		if (employeeId === this.draftFor) return;
		this.draftFor = employeeId;
		this.clear();
	}

	/** Empties the box once the page sent its text. */
	clear(): void {
		const box = this.quick()?.nativeElement;
		if (box) box.value = '';
	}

	protected send(event?: Event): void {
		// The Enter that confirms an IME composition (Japanese, Chinese, Korean input) is not a send.
		const key = event as KeyboardEvent | undefined;
		if (key?.isComposing || key?.keyCode === 229) return;
		const box = this.quick()?.nativeElement;
		const body = box?.value.trim() ?? '';
		if (!body || this.sending()) return;
		this.message.emit(body);
	}
}
