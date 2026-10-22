import { ChangeDetectionStrategy, Component, HostListener, inject, Input, OnChanges, OnDestroy, type SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbButtonModule, NbIconModule, NbInputModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { BaseEntityEnum, IComment, ID, PermissionsEnum } from '@gauzy/contracts';
import { CommentService, ImageAssetService, Store, ToastrService } from '@gauzy/ui-core/core';
import { IPersonChip, Loadable, loaded, loading, failed, personOf } from '../project-view.utils';
import { ICommentImage, parseCommentImages, withCommentImages } from './comment-images.util';

/** A comment as the tab draws it: its author and times worked out once, when the list is read. */
interface ICommentEntry {
	comment: IComment;
	/** What was written, without the attached images' lines. */
	text: string;
	images: ICommentImage[];
	author: IPersonChip | null;
	/** The author's profile: their employee page, or their user profile; none where it cannot be opened. */
	authorLink: string[] | null;
	/** "3 hours ago", for the thread card's latest reply, with the full date in its tooltip. */
	ago: string;
	timeLong: string;
	canDelete: boolean;
}

/** An image picked for the comment or reply box: shown at once from the file, uploaded in the background. */
interface IPendingImage {
	key: number;
	name: string;
	/** The file itself, as an object URL, until the comment is posted. */
	preview: string;
	/** The uploaded image's address; none while uploading. */
	url: string | null;
	uploading: boolean;
}

/** The comment box under the list, or the open thread's reply box. */
type CommentBox = 'comment' | 'reply';

/** The raster types the image upload takes; it refuses anything else. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
/** Images one comment can carry. */
const MAX_IMAGES = 10;
/** The upload folder, under the tenant's own directory. */
const IMAGE_FOLDER = 'comment_images';

/** A top-level comment with the replies posted under it, oldest first. */
interface ICommentThread {
	entry: ICommentEntry;
	replies: ICommentEntry[];
}

/**
 * The project page's Comments tab: the discussion on the project through the generic comment API —
 * comments, oldest first, each with its replies one level deep, a box to post a new one, a reply box per
 * thread, and delete where the server would allow it. Images attach to a comment or reply — picked, pasted or
 * dropped — and show under its text as thumbnails that open full size.
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
	// Not provided at the root: each user of the image upload provides it.
	providers: [ImageAssetService],
	templateUrl: './project-comments.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-comments.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectCommentsComponent implements OnChanges, OnDestroy {
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
	/** The images picked for each box, in the order picked. */
	public pending: Record<CommentBox, IPendingImage[]> = { comment: [], reply: [] };
	/** The image open full size, over the page. */
	public viewing: ICommentImage | null = null;

	private readonly _commentService = inject(CommentService);
	private readonly _store = inject(Store);
	private readonly _toastr = inject(ToastrService);
	private readonly _translate = inject(TranslateService);
	/** Numbers each read, so only the latest one is applied: a post and a delete can each refresh at once. */
	private _sequence = 0;
	private readonly _imageAssets = inject(ImageAssetService);
	private _imageKey = 0;

	/** The image upload asks for ALL_ORG_EDIT or MEDIA_GALLERY_ADD: without either, no attach button. */
	public readonly canAttach = this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD);

	ngOnChanges(changes: SimpleChanges): void {
		if (this.projectId && (changes['projectId'] || changes['organizationId'])) {
			this.openThreadId = null;
			this.confirmingDeleteId = null;
			this.clearImages('comment');
			this.clearImages('reply');
			this.threads = loading([]);
			void this.load();
		}
	}

	ngOnDestroy(): void {
		this.clearImages('comment');
		this.clearImages('reply');
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

	/** Posts the comment box's text, with its images, on the project. */
	async addComment(): Promise<void> {
		if (!this.canPost('comment') || this.postingComment) return;
		const text = this.commentControl.value.trim();
		const images = this.uploaded('comment');
		this.postingComment = true;
		if (await this.post(withCommentImages(text, images))) {
			// The box stays editable while posting: clear what was sent, keeping anything added since.
			if (this.commentControl.value.trim() === text) this.commentControl.reset();
			this.dropImages('comment', images);
		}
		this.postingComment = false;
	}

	/** Opens a thread's replies and reply box, or closes them when it is already open. */
	toggleThread(thread: ICommentThread): void {
		const id = thread.entry.comment.id;
		this.openThreadId = this.openThreadId === id ? null : id;
		this.replyControl.reset();
		this.clearImages('reply');
	}

	/** Opens the thread and puts the cursor in its reply box once it renders. */
	replyTo(thread: ICommentThread): void {
		const id = thread.entry.comment.id;
		if (this.openThreadId !== id) {
			this.openThreadId = id;
			this.replyControl.reset();
			this.clearImages('reply');
		}
		setTimeout(() => document.getElementById(`project-comment-reply-${id}`)?.focus());
	}

	/** Posts the reply box's text, with its images, under the thread's comment. */
	async addReply(thread: ICommentThread): Promise<void> {
		if (!this.canPost('reply') || this.postingReply) return;
		const text = this.replyControl.value.trim();
		const images = this.uploaded('reply');
		const id = thread.entry.comment.id;
		this.postingReply = true;
		// The reply box is shared by every thread: clear it only if the user is still in this thread, and only of
		// what was sent. The thread stays open to show the reply.
		if ((await this.post(withCommentImages(text, images), id)) && this.openThreadId === id) {
			if (this.replyControl.value.trim() === text) this.replyControl.reset();
			this.dropImages('reply', images);
		}
		this.postingReply = false;
	}

	/** Whether the box has something to post — text or an image — and no image still uploading. */
	canPost(box: CommentBox): boolean {
		const control = box === 'comment' ? this.commentControl : this.replyControl;
		const images = this.pending[box];
		return !images.some((image) => image.uploading) && (!!control.value.trim() || images.length > 0);
	}

	/** Attaches the image files picked with the attach button. */
	onPick(box: CommentBox, input: HTMLInputElement): void {
		this.attach(box, Array.from(input.files || []));
		// The same file can be picked again after being removed.
		input.value = '';
	}

	/** Attaches the images pasted into the box; pasted text is left to the box. */
	onPaste(box: CommentBox, event: ClipboardEvent): void {
		const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
		if (!files.length || !this.canAttach) return;
		event.preventDefault();
		this.attach(box, files);
	}

	/** Attaches the images dropped on the box. */
	onDrop(box: CommentBox, event: DragEvent): void {
		if (!this.canAttach || !event.dataTransfer?.files?.length) return;
		event.preventDefault();
		this.attach(box, Array.from(event.dataTransfer.files));
	}

	/** Lets files be dropped on the box. */
	onDragOver(event: DragEvent): void {
		if (this.canAttach && event.dataTransfer?.types?.includes('Files')) event.preventDefault();
	}

	/** Opens an attached image full size, with the focus on its close button. */
	openImage(image: ICommentImage): void {
		this.viewing = image;
		setTimeout(() => document.getElementById('project-comment-image-close')?.focus());
	}

	/** Esc closes the open image, wherever the focus is. */
	@HostListener('document:keydown.escape')
	closeImage(): void {
		this.viewing = null;
	}

	removeImage(box: CommentBox, image: IPendingImage): void {
		this.dropImages(box, [image]);
	}

	/**
	 * Shows each image at once from the file and uploads it. A type the upload refuses, or one past the limit,
	 * is turned away with a message.
	 */
	private attach(box: CommentBox, files: File[]): void {
		if (!this.canAttach) return;
		const images = files.filter((file) => IMAGE_TYPES.includes(file.type));
		if (images.length < files.length) {
			this._toastr.warning(this._translate.instant('PROJECT_VIEW.COMMENT_IMAGE_TYPES'));
		}
		const room = Math.max(MAX_IMAGES - this.pending[box].length, 0);
		if (images.length > room) {
			this._toastr.warning(this._translate.instant('PROJECT_VIEW.COMMENT_IMAGE_LIMIT', { count: MAX_IMAGES }));
		}
		for (const file of images.slice(0, room)) {
			const image: IPendingImage = {
				key: ++this._imageKey,
				name: file.name || 'image',
				preview: URL.createObjectURL(file),
				url: null,
				uploading: true
			};
			this.pending[box] = [...this.pending[box], image];
			void this.upload(box, image, file);
		}
	}

	/** Uploads one picked image; a failed upload leaves the box with a message. */
	private async upload(box: CommentBox, image: IPendingImage, file: File): Promise<void> {
		try {
			const asset = await this._imageAssets.upload(file, IMAGE_FOLDER, this.scope());
			if (!asset?.fullUrl) throw new Error();
			// A new item and array, so the box redraws.
			this.pending[box] = this.pending[box].map((item) =>
				item === image ? { ...image, url: asset.fullUrl, uploading: false } : item
			);
		} catch (error) {
			// Removed meanwhile, or the box was cleared: nothing to report.
			if (!this.pending[box].includes(image)) return;
			this.dropImages(box, [image]);
			this._toastr.danger(
				error?.error?.message || this._translate.instant('PROJECT_VIEW.COMMENT_IMAGE_FAILED', { name: image.name }),
				this._translate.instant('TOASTR.TITLE.ERROR')
			);
		}
	}

	/** The box's uploaded images, in order. */
	private uploaded(box: CommentBox): (IPendingImage & ICommentImage)[] {
		return this.pending[box].filter((image): image is IPendingImage & ICommentImage => !!image.url);
	}

	/** Takes images out of a box, letting go of their previews. */
	private dropImages(box: CommentBox, images: IPendingImage[]): void {
		const keys = new Set(images.map((image) => image.key));
		this.pending[box].filter((image) => keys.has(image.key)).forEach((image) => URL.revokeObjectURL(image.preview));
		this.pending[box] = this.pending[box].filter((image) => !keys.has(image.key));
	}

	private clearImages(box: CommentBox): void {
		this.dropImages(box, this.pending[box]);
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
		const { text, images } = parseCommentImages(comment.comment);
		return {
			comment,
			text,
			images,
			// A user without an employee record (an admin, say) posts with no employee: the user who posted it
			// names them.
			author: personOf(comment.employee) ?? personOf(comment.createdByUser),
			authorLink: this.authorLinkOf(comment),
			ago: time.fromNow(),
			timeLong: time.format('LLL'),
			canDelete: this.canDelete(comment)
		};
	}

	/**
	 * Where the author's name and avatar lead: an employee's page; for a user without an employee record, the
	 * signed-in user's own profile, or another user's profile for those who may open it (its route asks for
	 * ORG_USERS_EDIT and sends everyone else to the dashboard).
	 */
	private authorLinkOf(comment: IComment): string[] | null {
		if (comment.employee?.id) return ['/pages/employees/view', comment.employee.id];
		const userId = comment.createdByUser?.id ?? comment.createdByUserId;
		if (!userId) return null;
		if (userId === this._store.user?.id) return ['/pages/auth/profile'];
		return this._store.hasPermission(PermissionsEnum.ORG_USERS_EDIT) ? ['/pages/users/edit', userId] : null;
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
