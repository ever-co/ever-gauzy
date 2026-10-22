import { Component, OnInit, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { BaseEntityEnum, IComment, ID, IGoal, IKeyResult, IKeyResultUpdate, PermissionsEnum } from '@gauzy/contracts';
import { NbDialogRef, NbDialogService, NbTabComponent, NbTabsetComponent } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { CommentService, EmployeesService, GoalService, KeyResultService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { KeyResultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { KeyResultDetailsComponent } from '../keyresult-details/keyresult-details.component';

/** A top-level comment with the replies posted under it. */
export interface ICommentThread {
	comment: IComment;
	replies: IComment[];
}

@Component({
    selector: 'ga-goal-details',
    templateUrl: './goal-details.component.html',
    styleUrls: ['./goal-details.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GoalDetailsComponent extends TranslationBaseComponent implements OnInit {
	goal: IGoal;
	src: string;
	ownerName: string;
	updates: Array<IKeyResultUpdate> = [];
	comments: IComment[] = [];
	/** The comments as threads: each top-level comment with its replies, oldest first. */
	threads: ICommentThread[] = [];
	readonly commentControl = new FormControl<string>('', { nonNullable: true });
	postingComment = false;
	/** The thread whose replies and reply box are shown; one at a time. */
	openThreadId: ID | null = null;
	readonly replyControl = new FormControl<string>('', { nonNullable: true });
	postingReply = false;
	/** The comment showing its inline "Delete this comment?" confirmation; one at a time. */
	confirmingDeleteId: ID | null = null;
	deletingComment = false;
	/** The last read of the comments failed: the tab shows a retry instead of an empty or stale list. */
	commentsLoadError = false;
	loadingComments = false;
	/** Numbers each read of the comments, so only the latest one is applied. */
	private commentsLoadId = 0;
	/** `timeAgo`'s formatter, rebuilt only when the language changes. */
	private relativeTimeFormat: { lang: string; format: Intl.RelativeTimeFormat } | null = null;

	@ViewChild(NbTabsetComponent) tabset: NbTabsetComponent;
	@ViewChild('commentsTab') commentsTab: NbTabComponent;

	constructor(
		private readonly dialogRef: NbDialogRef<GoalDetailsComponent>,
		private readonly employeeService: EmployeesService,
		private readonly dialogService: NbDialogService,
		private readonly keyResultService: KeyResultService,
		private readonly goalService: GoalService,
		private readonly commentService: CommentService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		if (!!this.goal.ownerEmployee) {
			const employee = await firstValueFrom(
				this.employeeService.getEmployeeById(this.goal.ownerEmployee.id, ['user'])
			);
			this.src = employee.user.imageUrl;
			this.ownerName = employee.user.name;
		} else if (!!this.goal.organization) {
			this.ownerName = this.goal.organization.name;
			this.src = this.goal.organization.imageUrl;
		} else {
			this.ownerName = this.goal.ownerTeam.name;
		}

		this.goal.keyResults.forEach((keyResult) => {
			this.updates.push(...keyResult.updates);
		});

		await this.loadComments();
	}

	/**
	 * Reads the objective's comments, oldest first. Resolves `false` when the read failed: the tab then shows a
	 * retry rather than "No Comments yet" or a stale list, so a write followed by a failed refresh is told apart
	 * from a write that is on screen.
	 *
	 * A comment and a reply can post at once, each refreshing the list, so reads may finish out of order: only
	 * the latest read applies its list, error and loading state, and an older one finishing later is dropped.
	 */
	async loadComments(): Promise<boolean> {
		const loadId = ++this.commentsLoadId;
		this.loadingComments = true;
		try {
			const { items } = await this.commentService.getAll(BaseEntityEnum.Goal, this.goal.id, this.commentScope());
			if (loadId === this.commentsLoadId) {
				this.comments = items;
				this.threads = this.buildThreads(items);
				this.commentsLoadError = false;
			}
			return true;
		} catch (error) {
			console.log('Error while loading objective comments', error);
			if (loadId === this.commentsLoadId) {
				this.commentsLoadError = true;
			}
			return false;
		} finally {
			if (loadId === this.commentsLoadId) {
				this.loadingComments = false;
			}
		}
	}

	/** Posts the comment box's text on this objective, then shows it in the Comments tab. */
	async addComment() {
		const comment = this.commentControl.value.trim();
		if (!comment || this.postingComment) {
			return;
		}
		this.postingComment = true;
		if (await this.postComment(comment)) {
			// The box stays editable while posting: clear it only if it still holds what was sent.
			if (this.commentControl.value.trim() === comment) {
				this.commentControl.reset();
			}
			this.tabset?.selectTab(this.commentsTab);
		}
		this.postingComment = false;
	}

	/** Opens a thread's replies and reply box, or closes them when it is already open. */
	toggleThread(thread: ICommentThread) {
		this.openThreadId = this.openThreadId === thread.comment.id ? null : thread.comment.id;
		this.replyControl.reset();
	}

	/**
	 * Opens the thread and focuses its reply box once it renders — focusing also scrolls the box into view
	 * inside the tab's fixed-height panel.
	 */
	replyTo(thread: ICommentThread) {
		if (this.openThreadId !== thread.comment.id) {
			this.openThreadId = thread.comment.id;
			this.replyControl.reset();
		}
		setTimeout(() => document.getElementById(`reply-${thread.comment.id}`)?.focus());
	}

	/** Posts the reply box's text as a reply to the thread's comment; the thread stays open to show it. */
	async addReply(thread: ICommentThread) {
		const comment = this.replyControl.value.trim();
		if (!comment || this.postingReply) {
			return;
		}
		this.postingReply = true;
		// The reply box is shared by every thread: clear it only if the user is still in this thread and has
		// not typed something else meanwhile, so a finishing reply never erases another thread's draft.
		if (
			(await this.postComment(comment, thread.comment.id)) &&
			this.openThreadId === thread.comment.id &&
			this.replyControl.value.trim() === comment
		) {
			this.replyControl.reset();
		}
		this.postingReply = false;
	}

	/**
	 * Whether the current user may delete the comment, on the server's terms (`CommentService.assertMayManage`):
	 * a CHANGE_SELECTED_EMPLOYEE holder may delete any; anyone else only their own — by author when they have an
	 * employee record, by `createdByUserId` when they do not.
	 */
	canDelete(comment: IComment): boolean {
		if (this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return true;
		}
		const user = this.store.user;
		if (!user) {
			return false;
		}
		const employeeId = user.employee?.id ?? user.employeeId;
		return employeeId ? comment.employeeId === employeeId : comment.createdByUserId === user.id;
	}

	/**
	 * Deletes a comment once its inline confirmation is accepted (the trash icon sets `confirmingDeleteId`).
	 * Its replies are kept: the database unlinks them (`SET NULL`), so they show as comments of their own.
	 */
	async deleteComment(comment: IComment) {
		if (this.deletingComment) {
			return;
		}
		this.deletingComment = true;
		try {
			await this.commentService.delete(comment.id);
			if (this.openThreadId === comment.id) {
				this.openThreadId = null;
			}
			await this.loadComments();
			this.toastrService.success('GOALS_PAGE.COMMENT_THREAD.DELETED');
		} catch (error) {
			this.toastrService.danger(error?.error?.message ?? error?.message, this.getTranslation('TOASTR.TITLE.ERROR'));
		} finally {
			this.confirmingDeleteId = null;
			this.deletingComment = false;
		}
	}

	authorName(comment: IComment): string {
		return (
			comment.employee?.fullName ||
			comment.employee?.user?.name ||
			this.getTranslation('GOALS_PAGE.COMMENT_THREAD.UNKNOWN_AUTHOR')
		);
	}

	authorInitials(comment: IComment): string {
		return this.authorName(comment)
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('');
	}

	/** How long ago, in the narrow form of the current language: "15d ago", "3h ago", "now". */
	timeAgo(date: Date | string): string {
		const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
		const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
			['year', 31536000],
			['month', 2592000],
			['week', 604800],
			['day', 86400],
			['hour', 3600],
			['minute', 60]
		];
		const format = this.relativeTimeFormatter();
		for (const [unit, size] of units) {
			if (Math.abs(seconds) >= size) {
				return format.format(Math.round(seconds / size), unit);
			}
		}
		return format.format(0, 'second');
	}

	/**
	 * `timeAgo` runs per comment on every change detection, so the formatter is kept and rebuilt only when the
	 * current language changes.
	 */
	private relativeTimeFormatter(): Intl.RelativeTimeFormat {
		const lang = this.translateService.getCurrentLang() || 'en';
		if (this.relativeTimeFormat?.lang !== lang) {
			this.relativeTimeFormat = {
				lang,
				format: new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'narrow' })
			};
		}
		return this.relativeTimeFormat.format;
	}

	/**
	 * Posts a comment on this objective, or a reply when `parentId` is given, then re-reads the list — the
	 * create response carries no author relation. Resolves `true` once the post is saved, whether or not the
	 * refresh after it succeeds (a failed refresh shows as the tab's retry), and `false` when the post failed.
	 */
	private async postComment(comment: string, parentId?: ID): Promise<boolean> {
		try {
			await this.commentService.create({
				comment,
				entity: BaseEntityEnum.Goal,
				entityId: this.goal.id,
				entityName: this.goal.name,
				...(parentId ? { parentId } : {}),
				...this.commentScope()
			});
			await this.loadComments();
			return true;
		} catch (error) {
			this.toastrService.danger(error?.error?.message ?? error?.message, this.getTranslation('TOASTR.TITLE.ERROR'));
			return false;
		}
	}

	/**
	 * Groups the flat list into threads. Replies are one level deep: a reply to a reply joins the thread of
	 * the comment at its root, and a reply whose parent is gone is shown as a comment of its own.
	 */
	private buildThreads(comments: IComment[]): ICommentThread[] {
		const byId = new Map(comments.map((comment) => [comment.id, comment]));
		const rootOf = (comment: IComment): IComment => {
			const seen = new Set<ID>();
			let current = comment;
			while (current.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
				seen.add(current.id);
				current = byId.get(current.parentId);
			}
			return current;
		};
		const threads = new Map<ID, ICommentThread>();
		for (const comment of comments) {
			const root = rootOf(comment);
			if (!threads.has(root.id)) {
				threads.set(root.id, { comment: root, replies: [] });
			}
			if (root !== comment) {
				threads.get(root.id).replies.push(comment);
			}
		}
		return [...threads.values()];
	}

	private commentScope() {
		return { organizationId: this.goal.organizationId, tenantId: this.goal.tenantId };
	}

	async deleteGoal() {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.getTranslation('GOALS_PAGE.DELETE_OBJECTIVE'),
					message: this.getTranslation('GOALS_PAGE.ARE_YOU_SURE'),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.goalService.delete(this.goal.id).catch((error) => console.log(error));
				this.dialogRef.close('deleted');
			}
		}
	}

	calculateKeyResultWeight(weight) {
		const weightSum = this.goal.keyResults.reduce((a, b) => a + +b.weight, 0);
		return Math.round(+weight * (100 / weightSum));
	}

	/**
	 * Opens a key result's details.
	 *
	 * @param index Its position in this objective's `keyResults`, or `null` when it is not one of them — the
	 * Alignments tab opens the key result this objective hangs from, which belongs to another objective.
	 * @param selectedKeyResult The key result to show.
	 */
	async keyResultDetails(index: number | null, selectedKeyResult: IKeyResult) {
		const dialog = this.dialogService.open(KeyResultDetailsComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedKeyResult
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			// `index !== null` in both branches, not a truthy test: `splice(null, 1)` dropped the first key
			// result whenever the Alignments tab deleted one, and `!!index` skipped the update for index 0 —
			// the first key result in the list was the one that never refreshed.
			if (response === 'deleted') {
				if (index !== null) {
					this.goal.keyResults.splice(index, 1);
				}
				this.toastrService.danger(
					this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_DELETED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			} else if (index !== null) {
				this.goal.keyResults[index] = response;
				this.goal.progress = this.calculateGoalProgress(this.goal.keyResults);
			}
		}
	}

	async keyResultUpdate(selectedKeyResult) {
		const dialog = this.dialogService.open(KeyResultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedKeyResult
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			const keyResultData = response;
			delete keyResultData.goal;
			delete keyResultData.updates;
			await this.keyResultService.update(selectedKeyResult.id, keyResultData);
			this.goal.progress = this.calculateGoalProgress(this.goal.keyResults);
		}
	}

	calculateGoalProgress(keyResults) {
		const progressTotal = keyResults.reduce((a: number, b: IKeyResult) => a + b.progress * +b.weight, 0);
		const weightTotal = keyResults.reduce((a, b) => a + +b.weight, 0);
		return Math.round(progressTotal / weightTotal);
	}

	closeDialog(isSaved: boolean) {
		isSaved ? this.dialogRef.close(this.goal) : this.dialogRef.close();
	}
}
