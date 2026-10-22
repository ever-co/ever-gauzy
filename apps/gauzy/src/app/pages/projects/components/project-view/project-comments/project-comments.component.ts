import { ChangeDetectionStrategy, Component, inject, Input, OnChanges, type SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbButtonModule, NbIconModule, NbInputModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { BaseEntityEnum, IComment, ID, PermissionsEnum } from '@gauzy/contracts';
import { CommentService, Store, ToastrService } from '@gauzy/ui-core/core';
import { IPersonChip, Loadable, loaded, loading, failed, personOf } from '../project-view.utils';

/** A comment as the tab draws it: its author and times worked out once, when the list is read. */
interface ICommentEntry {
	comment: IComment;
	author: IPersonChip | null;
	/** The author's employee page; none for a user without an employee record. */
	authorLink: string[] | null;
	/** "3 hours ago", for the thread card's latest reply, with the full date in its tooltip. */
	ago: string;
	timeLong: string;
	canDelete: boolean;
}

/** A top-level comment with the replies posted under it, oldest first. */
interface ICommentThread {
	entry: ICommentEntry;
	replies: ICommentEntry[];
}

/**
 * The project page's Comments tab: the discussion on the project through the generic comment API —
 * comments, oldest first, each with its replies one level deep, a box to post a new one, a reply box per
 * thread, and delete where the server would allow it.
 */
@Component({
	selector: 'ga-project-comments',
	standalone: true,
	imports: [
		CommonModule,
		ReactiveFormsModule,
		RouterModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
	],
	templateUrl: './project-comments.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-comments.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectCommentsComponent implements OnChanges {
	@Input() projectId: string;
	@Input() projectName: string;
	@Input() organizationId: string;
	@Input() tenantId: string;

	public threads: Loadable<ICommentThread[]> = loading([]);
	public count = 0;

	readonly commentControl = new FormControl<string>('', { nonNullable: true });
	public postingComment = false;
	/** The thread whose replies and reply box are shown; one at a time. */
	public openThreadId: ID | null = null;
	readonly replyControl = new FormControl<string>('', { nonNullable: true });
	public postingReply = false;
	/** The comment showing its inline "Delete this comment?" confirmation; one at a time. */
	public confirmingDeleteId: ID | null = null;
	public deleting = false;

	private readonly _commentService = inject(CommentService);
	private readonly _store = inject(Store);
	private readonly _toastr = inject(ToastrService);
	private readonly _translate = inject(TranslateService);
	/** Numbers each read, so only the latest one is applied: a post and a delete can each refresh at once. */
	private _sequence = 0;

	ngOnChanges(changes: SimpleChanges): void {
		if (this.projectId && (changes['projectId'] || changes['organizationId'])) {
			this.openThreadId = null;
			this.confirmingDeleteId = null;
			this.threads = loading([]);
			void this.load();
		}
	}

	/** Reads (or re-reads) the project's comments; the list on screen stays while it reloads. */
	async load(): Promise<void> {
		const sequence = ++this._sequence;
		this.threads = loading(this.threads.value);
		try {
			const { items } = await this._commentService.getAll(BaseEntityEnum.OrganizationProject, this.projectId, this.scope());
			if (sequence !== this._sequence) return;
			this.threads = loaded(this.buildThreads(items));
			this.count = items.length;
		} catch {
			if (sequence !== this._sequence) return;
			// A failed read shows a retry, never "no comments" or a stale list.
			this.threads = failed([]);
			this.count = 0;
		}
	}

	/** Posts the comment box's text on the project. */
	async addComment(): Promise<void> {
		const comment = this.commentControl.value.trim();
		if (!comment || this.postingComment) return;
		this.postingComment = true;
		// The box stays editable while posting: clear it only if it still holds what was sent.
		if ((await this.post(comment)) && this.commentControl.value.trim() === comment) {
			this.commentControl.reset();
		}
		this.postingComment = false;
	}

	/** Opens a thread's replies and reply box, or closes them when it is already open. */
	toggleThread(thread: ICommentThread): void {
		const id = thread.entry.comment.id;
		this.openThreadId = this.openThreadId === id ? null : id;
		this.replyControl.reset();
	}

	/** Opens the thread and puts the cursor in its reply box once it renders. */
	replyTo(thread: ICommentThread): void {
		const id = thread.entry.comment.id;
		if (this.openThreadId !== id) {
			this.openThreadId = id;
			this.replyControl.reset();
		}
		setTimeout(() => document.getElementById(`project-comment-reply-${id}`)?.focus());
	}

	/** Posts the reply box's text under the thread's comment. */
	async addReply(thread: ICommentThread): Promise<void> {
		const comment = this.replyControl.value.trim();
		const id = thread.entry.comment.id;
		if (!comment || this.postingReply) return;
		this.postingReply = true;
		// The reply box is shared by every thread: clear it only if the user is still in this thread and has not
		// typed something else meanwhile. The thread stays open to show the reply.
		if ((await this.post(comment, id)) && this.openThreadId === id && this.replyControl.value.trim() === comment) {
			this.replyControl.reset();
		}
		this.postingReply = false;
	}

	/**
	 * Deletes a comment once its inline confirmation is accepted. Its replies are kept: the database unlinks
	 * them (`SET NULL`), so they show as comments of their own.
	 */
	async deleteComment(comment: IComment): Promise<void> {
		if (this.deleting) return;
		this.deleting = true;
		try {
			await this._commentService.delete(comment.id);
			if (this.openThreadId === comment.id) this.openThreadId = null;
			this._toastr.success('GOALS_PAGE.COMMENT_THREAD.DELETED');
			await this.load();
		} catch (error) {
			this._toastr.danger(error?.error?.message ?? error?.message, this._translate.instant('TOASTR.TITLE.ERROR'));
		} finally {
			this.confirmingDeleteId = null;
			this.deleting = false;
		}
	}

	/**
	 * Posts a comment, or a reply under `parentId`, then re-reads the list — the create response carries no
	 * author. Resolves `true` once the post is saved, whether or not the refresh after it succeeds.
	 */
	private async post(comment: string, parentId?: ID): Promise<boolean> {
		try {
			await this._commentService.create({
				comment,
				entity: BaseEntityEnum.OrganizationProject,
				entityId: this.projectId,
				entityName: this.projectName,
				...(parentId ? { parentId } : {}),
				...this.scope()
			});
		} catch (error) {
			this._toastr.danger(error?.error?.message ?? error?.message, this._translate.instant('TOASTR.TITLE.ERROR'));
			return false;
		}
		await this.load();
		return true;
	}

	/**
	 * Groups the flat list into threads. Replies are one level deep: a reply to a reply joins the thread of the
	 * comment at its root, and a reply whose parent is gone is shown as a comment of its own.
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
				threads.set(root.id, { entry: this.toEntry(root), replies: [] });
			}
			if (root !== comment) {
				threads.get(root.id).replies.push(this.toEntry(comment));
			}
		}
		return [...threads.values()];
	}

	private toEntry(comment: IComment): ICommentEntry {
		const time = moment(comment.createdAt);
		return {
			comment,
			// A user without an employee record (an admin, say) posts with no employee: the user who posted it
			// names them.
			author: personOf(comment.employee) ?? personOf(comment.createdByUser),
			authorLink: comment.employee?.id ? ['/pages/employees/view', comment.employee.id] : null,
			ago: time.fromNow(),
			timeLong: time.format('LLL'),
			canDelete: this.canDelete(comment)
		};
	}

	/**
	 * Whether the current user may delete the comment, on the server's terms (`CommentService.assertMayManage`):
	 * a CHANGE_SELECTED_EMPLOYEE holder may delete any; anyone else only their own — by author when they have an
	 * employee record, by `createdByUserId` when they do not.
	 */
	private canDelete(comment: IComment): boolean {
		if (this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) return true;
		const user = this._store.user;
		if (!user) return false;
		const employeeId = user.employee?.id ?? user.employeeId;
		return employeeId ? comment.employeeId === employeeId : comment.createdByUserId === user.id;
	}

	private scope() {
		return { organizationId: this.organizationId, tenantId: this.tenantId };
	}
}
