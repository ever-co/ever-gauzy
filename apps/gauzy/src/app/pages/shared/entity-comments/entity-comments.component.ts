import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	HostListener,
	inject,
	Input,
	OnChanges,
	OnDestroy,
	Output,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { BaseEntityEnum, IComment, ID, IImageAsset, PermissionsEnum } from '@gauzy/contracts';
import { CommentService, ImageAssetService, Store, ToastrService } from '@gauzy/ui-core/core';
import {
	IPersonChip,
	Loadable,
	loaded,
	loading,
	failed,
	personOf
} from '../../projects/components/project-view/project-view.utils';
import { ICommentImage, parseCommentImages, withCommentImages } from './comment-images.util';

/**
 * The texts that name what the comments are (translation keys): a contact's "notes" are a project's "comments".
 * Each one left out keeps the comments' own wording.
 */
export interface IEntityCommentsLabels {
	/** Shown when the record has none yet. */
	empty: string;
	/** The comment box's placeholder. */
	placeholder: string;
	/** The comment box's send button. */
	send: string;
	/** The message after one is deleted. */
	deleted: string;
}

export const DEFAULT_ENTITY_COMMENTS_LABELS: Readonly<IEntityCommentsLabels> = Object.freeze({
	empty: 'PROJECT_VIEW.NO_COMMENTS',
	placeholder: 'PROJECT_VIEW.COMMENT_PLACEHOLDER',
	send: 'BUTTONS.ADD_COMMENT',
	deleted: 'GOALS_PAGE.COMMENT_THREAD.DELETED'
});

/** Numbers each instance, so the ids of its boxes are unique on a page that shows more than one. */
let instances = 0;

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
	/** The uploaded image asset; none while uploading. */
	assetId: ID | null;
	uploading: boolean;
}

/** An image asset's addresses, as the server last worked them out, and when. */
interface IImageUrls {
	full: string;
	thumb: string;
	at: number;
}

/** An image open full size. */
interface IViewedImage {
	name: string;
	url: string;
}

/** The comment box under the list, or the open thread's reply box. */
type CommentBox = 'comment' | 'reply';

/** The raster types the image upload takes; it refuses anything else. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
/** Images one comment can carry. */
const MAX_IMAGES = 10;
/** The upload folder, under the tenant's own directory. */
const IMAGE_FOLDER = 'comment_images';
/**
 * How long an image's looked-up address is reused. On S3-family storage it is signed for an hour
 * (PRESIGNED_URL_EXPIRES_IN_SECONDS); half of that leaves an address on screen time to load.
 */
const IMAGE_URL_TTL_MS = 30 * 60 * 1000;

/** A top-level comment with the replies posted under it, oldest first. */
interface ICommentThread {
	entry: ICommentEntry;
	replies: ICommentEntry[];
}

/**
 * The discussion on one record through the generic comment API — a project's Comments tab, a contact's Notes —
 * comments, oldest first (or newest first, with the box above them), each with its replies one level deep, a box
 * to post a new one, a reply box per thread, and delete where the server would allow it. Images attach to a
 * comment or reply — picked, pasted or dropped — and show under its text as thumbnails that open full size.
 *
 * A reader who may not write the record's comments (`canWrite` false) sees them without the boxes, replies and
 * delete. The server decides either way: this only keeps the page from offering what it would refuse.
 *
 * An image is uploaded as an image asset when it is picked; the comment refers to the asset, and its address is
 * looked up through the image asset API when comments are read. An upload that is not posted — removed, left in
 * an unsent box, or finished after its image was removed — is deleted again.
 */
@Component({
	selector: 'ga-entity-comments',
	standalone: true,
	imports: [
		CommonModule,
		ReactiveFormsModule,
		RouterModule,
		A11yModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
	],
	// Not provided at the root: each user of the image upload provides it.
	providers: [ImageAssetService],
	templateUrl: './entity-comments.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./entity-comments.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class EntityCommentsComponent implements OnChanges, OnDestroy {
	/** The type of the record the comments hang off. */
	@Input() entity: BaseEntityEnum;
	@Input() entityId: ID;
	/** The record's name, which mention notifications quote. */
	@Input() entityName: string;
	@Input() organizationId: string;
	@Input() tenantId: string;
	/** Newest first, the comment box above them; oldest first, the box under them, by default. */
	@Input() newestFirst = false;
	/** Whether the reader may post, reply and delete. */
	@Input() canWrite = true;
	/** What the comments are called; see {@link IEntityCommentsLabels}. */
	@Input() set labels(labels: Partial<IEntityCommentsLabels> | null | undefined) {
		this.text = { ...DEFAULT_ENTITY_COMMENTS_LABELS, ...(labels ?? {}) };
	}
	/** The number of comments, replies included, each time the list is read: the page shows it on the tab. */
	@Output() readonly countChange = new EventEmitter<number>();

	protected text: IEntityCommentsLabels = { ...DEFAULT_ENTITY_COMMENTS_LABELS };
	/** The prefix of this instance's box ids. */
	protected readonly idPrefix = `ga-entity-comments-${++instances}`;

	protected threads: Loadable<ICommentThread[]> = loading([]);

	protected readonly commentControl = new FormControl<string>('', { nonNullable: true });
	protected postingComment = false;
	/** The thread whose replies and reply box are shown; one at a time. */
	protected openThreadId: ID | null = null;
	protected readonly replyControl = new FormControl<string>('', { nonNullable: true });
	protected postingReply = false;
	/** The comment showing its inline "Delete this comment?" confirmation; one at a time. */
	protected confirmingDeleteId: ID | null = null;
	protected deleting = false;
	/** The images picked for each box, in the order picked. */
	protected pending: Record<CommentBox, IPendingImage[]> = { comment: [], reply: [] };
	/** The uploads each box's post in flight refers to: only these are kept when the box is cleared mid-post. */
	private posting: Record<CommentBox, Set<ID>> = { comment: new Set(), reply: new Set() };
	/** The image open full size, over the page. */
	protected viewing: IViewedImage | null = null;
	/** Each attached image's addresses by asset; `null` once a lookup failed (deleted, or not readable here). */
	protected imageUrls = new Map<ID, IImageUrls | null>();

	private readonly _commentService = inject(CommentService);
	private readonly _store = inject(Store);
	private readonly _toastr = inject(ToastrService);
	private readonly _translate = inject(TranslateService);
	private readonly _imageAssets = inject(ImageAssetService);
	/** Numbers each read, so only the latest one is applied: a post and a delete can each refresh at once. */
	private _sequence = 0;
	private _imageKey = 0;

	/** Lookups of image addresses under way, by asset, so an image is looked up once at a time. */
	private readonly _lookups = new Map<ID, Promise<IImageUrls | null>>();

	/**
	 * Attaching is offered only to those who can upload an image, delete it again — so an upload that is never
	 * posted can always be cleaned up — and read it back, so what they post shows for them: the upload asks for
	 * ALL_ORG_EDIT or MEDIA_GALLERY_ADD, the delete for ALL_ORG_EDIT or MEDIA_GALLERY_DELETE, and the read
	 * (`GET /image-assets/:id`) for ALL_ORG_VIEW or MEDIA_GALLERY_VIEW.
	 */
	protected readonly canAttach =
		(this._store.hasPermission(PermissionsEnum.ALL_ORG_EDIT) ||
			this._store.hasAllPermissions(PermissionsEnum.MEDIA_GALLERY_ADD, PermissionsEnum.MEDIA_GALLERY_DELETE)) &&
		this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW);

	ngOnChanges(changes: SimpleChanges): void {
		if (this.entity && this.entityId && (changes['entity'] || changes['entityId'] || changes['organizationId'])) {
			this.openThreadId = null;
			this.confirmingDeleteId = null;
			this.clearImages('comment');
			this.clearImages('reply');
			this.threads = loading([]);
			void this.load();
		}
	}

	ngOnDestroy(): void {
		// An unsent box's uploads go with it.
		this.clearImages('comment');
		this.clearImages('reply');
	}

	/** Reads (or re-reads) the record's comments; the list on screen stays while it reloads. */
	protected async load(): Promise<void> {
		const sequence = ++this._sequence;
		this.threads = loading(this.threads.value);
		try {
			const { items } = await this._commentService.getAll(this.entity, this.entityId, this.scope());
			if (sequence !== this._sequence) return;
			const threads = this.buildThreads(items);
			this.threads = loaded(threads);
			this.countChange.emit(items.length);
			void this.lookUpImages(threads);
		} catch {
			if (sequence !== this._sequence) return;
			// A failed read shows a retry, never "no comments" or a stale list.
			this.threads = failed([]);
		}
	}

	/** Posts the comment box's text, with its images, on the record. */
	protected async addComment(): Promise<void> {
		if (!this.canPost('comment') || this.postingComment) return;
		const text = this.commentControl.value.trim();
		const images = this.uploaded('comment');
		this.postingComment = true;
		this.posting.comment = new Set(images.map((image) => image.assetId));
		if (await this.post(withCommentImages(text, images))) {
			// The box stays editable while posting: clear what was sent, keeping anything added since.
			if (this.commentControl.value.trim() === text) this.commentControl.reset();
			this.dropImages('comment', images);
		}
		this.posting.comment = new Set();
		this.postingComment = false;
	}

	/** Opens a thread's replies and reply box, or closes them when it is already open. */
	protected toggleThread(thread: ICommentThread): void {
		const id = thread.entry.comment.id;
		this.openThreadId = this.openThreadId === id ? null : id;
		this.replyControl.reset();
		this.clearImages('reply');
	}

	/** Opens the thread and puts the cursor in its reply box once it renders. */
	protected replyTo(thread: ICommentThread): void {
		const id = thread.entry.comment.id;
		if (this.openThreadId !== id) {
			this.openThreadId = id;
			this.replyControl.reset();
			this.clearImages('reply');
		}
		setTimeout(() => document.getElementById(`${this.idPrefix}-reply-${id}`)?.focus());
	}

	/** Posts the reply box's text, with its images, under the thread's comment. */
	protected async addReply(thread: ICommentThread): Promise<void> {
		if (!this.canPost('reply') || this.postingReply) return;
		const text = this.replyControl.value.trim();
		const images = this.uploaded('reply');
		const id = thread.entry.comment.id;
		this.postingReply = true;
		this.posting.reply = new Set(images.map((image) => image.assetId));
		// The reply box is shared by every thread: clear it only if the user is still in this thread, and only of
		// what was sent. The thread stays open to show the reply.
		if ((await this.post(withCommentImages(text, images), id)) && this.openThreadId === id) {
			if (this.replyControl.value.trim() === text) this.replyControl.reset();
			this.dropImages('reply', images);
		}
		this.posting.reply = new Set();
		this.postingReply = false;
	}

	/** Whether the box has something to post — text or an image — and no image still uploading. */
	protected canPost(box: CommentBox): boolean {
		const control = box === 'comment' ? this.commentControl : this.replyControl;
		const images = this.pending[box];
		return !images.some((image) => image.uploading) && (!!control.value.trim() || images.length > 0);
	}

	/** Whether the box is posting: its images are on their way into a comment and cannot be removed. */
	protected isPosting(box: CommentBox): boolean {
		return box === 'comment' ? this.postingComment : this.postingReply;
	}

	/** Attaches the image files picked with the attach button. */
	protected onPick(box: CommentBox, input: HTMLInputElement): void {
		this.attach(box, Array.from(input.files || []));
		// The same file can be picked again after being removed.
		input.value = '';
	}

	/** Attaches the images pasted into the box; pasted text is left to the box. */
	protected onPaste(box: CommentBox, event: ClipboardEvent): void {
		const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
		if (!files.length || !this.canAttach) return;
		event.preventDefault();
		this.attach(box, files);
	}

	/** Attaches the images dropped on the box. */
	protected onDrop(box: CommentBox, event: DragEvent): void {
		if (!this.canAttach || !event.dataTransfer?.files?.length) return;
		event.preventDefault();
		this.attach(box, Array.from(event.dataTransfer.files));
	}

	/** Lets files be dropped on the box. */
	protected onDragOver(event: DragEvent): void {
		if (this.canAttach && event.dataTransfer?.types?.includes('Files')) event.preventDefault();
	}

	/**
	 * Opens an attached image full size. Its address is looked up again first when it is too old to still be
	 * signed, or when the last lookup failed — the tab can stay open long after the list was read. The viewer traps
	 * the focus while open and gives it back to the thumbnail when it closes.
	 */
	protected async openImage(image: ICommentImage): Promise<void> {
		let urls = this.imageUrls.get(image.assetId);
		if (!this.isFresh(urls)) urls = await this.lookUpImage(image.assetId);
		if (urls) this.viewing = { name: image.name, url: urls.full };
	}

	/** Esc closes the open image, wherever the focus is. */
	@HostListener('document:keydown.escape')
	protected closeImage(): void {
		this.viewing = null;
	}

	/** Takes a picked image out of its box, deleting its upload; not while the box is posting it. */
	protected removeImage(box: CommentBox, image: IPendingImage): void {
		if (this.isPosting(box)) return;
		this.discardImages(box, [image]);
	}

	/**
	 * Looks up the addresses of the images the comments refer to that have none fresh — not known yet, known for
	 * too long to still be signed, or whose last lookup failed — all at once.
	 */
	private async lookUpImages(threads: ICommentThread[]): Promise<void> {
		let ids = new Set<ID>();
		for (const thread of threads) {
			for (const entry of [thread.entry, ...thread.replies]) {
				for (const image of entry.images) {
					if (!this.isFresh(this.imageUrls.get(image.assetId))) ids.add(image.assetId);
				}
			}
		}
		await Promise.all([...ids].map((id) => this.lookUpImage(id)));
	}

	/**
	 * Looks up one image's addresses through the image asset API, which works them out afresh. A failed lookup
	 * shows the image as unavailable until it is tried again — on the next read of the list, or when it is clicked.
	 * A lookup already under way for the image is shared.
	 */
	private lookUpImage(id: ID): Promise<IImageUrls | null> {
		let lookup = this._lookups.get(id);
		if (!lookup) {
			lookup = this._imageAssets
				.getById(id)
				.then((asset) => this.remember(asset))
				.catch(() => {
					this.imageUrls.set(id, null);
					return null;
				})
				.finally(() => {
					this._lookups.delete(id);
					// A new map, so the thumbnails redraw.
					this.imageUrls = new Map(this.imageUrls);
				});
			this._lookups.set(id, lookup);
		}
		return lookup;
	}

	/** Whether an image's addresses are known and young enough to still be signed. */
	private isFresh(urls: IImageUrls | null | undefined): urls is IImageUrls {
		return !!urls && Date.now() - urls.at <= IMAGE_URL_TTL_MS;
	}

	/** Keeps an asset's addresses as the server answered them. */
	private remember(asset: IImageAsset): IImageUrls {
		if (!asset?.id || !asset.fullUrl) throw new Error('The image asset has no address');
		const urls: IImageUrls = { full: asset.fullUrl, thumb: asset.thumbUrl || asset.fullUrl, at: Date.now() };
		this.imageUrls.set(asset.id, urls);
		return urls;
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
				assetId: null,
				uploading: true
			};
			this.pending[box] = [...this.pending[box], image];
			void this.upload(box, image, file);
		}
	}

	/**
	 * Uploads one picked image. One removed while it uploaded is deleted again once stored; a failed upload leaves
	 * the box with a message.
	 */
	private async upload(box: CommentBox, image: IPendingImage, file: File): Promise<void> {
		let asset: IImageAsset;
		try {
			asset = await this._imageAssets.upload(file, IMAGE_FOLDER, this.scope());
			if (!asset?.id) throw new Error('The upload answered no image asset');
		} catch (error) {
			// Removed meanwhile, or the box was cleared: nothing to report.
			if (!this.isPending(box, image)) return;
			this.dropImages(box, [image]);
			this._toastr.danger(
				error?.error?.message ||
					this._translate.instant('PROJECT_VIEW.COMMENT_IMAGE_FAILED', { name: image.name }),
				this._translate.instant('TOASTR.TITLE.ERROR')
			);
			return;
		}
		if (!this.isPending(box, image)) {
			// Removed while it uploaded: no comment will refer to it.
			this.deleteAssets([asset.id]);
			return;
		}
		// Its addresses are known now: showing it once posted needs no lookup.
		if (asset.fullUrl) this.remember(asset);
		// A new item and array, so the box redraws.
		this.pending[box] = this.pending[box].map((item) =>
			item.key === image.key ? { ...item, assetId: asset.id, uploading: false } : item
		);
	}

	private isPending(box: CommentBox, image: IPendingImage): boolean {
		return this.pending[box].some((item) => item.key === image.key);
	}

	/** The box's uploaded images, in order. */
	private uploaded(box: CommentBox): ICommentImage[] {
		return this.pending[box]
			.filter((image) => !!image.assetId)
			.map((image) => ({ name: image.name, assetId: image.assetId }));
	}

	/**
	 * Takes images out of a box — by key, or by asset for the images just posted — letting go of their previews.
	 * Their uploads stay: a posted comment refers to them.
	 */
	private dropImages(box: CommentBox, images: { key?: number; assetId?: ID | null }[]): void {
		const keys = new Set(images.map((image) => image.key).filter((key) => key !== undefined));
		const assetIds = new Set(images.map((image) => image.assetId).filter(Boolean));
		const gone = (image: IPendingImage) => keys.has(image.key) || (!!image.assetId && assetIds.has(image.assetId));
		this.pending[box].filter(gone).forEach((image) => URL.revokeObjectURL(image.preview));
		this.pending[box] = this.pending[box].filter((image) => !gone(image));
	}

	/** Takes images out of a box and deletes their uploads: they will not be posted. */
	private discardImages(box: CommentBox, images: IPendingImage[]): void {
		this.deleteAssets(images.map((image) => image.assetId).filter(Boolean));
		this.dropImages(box, images);
	}

	/**
	 * Empties a box, deleting its uploads — except those the post in flight refers to: they are only dropped, as
	 * the comment on its way needs them. An image added during that post is not in it, so it is deleted.
	 */
	private clearImages(box: CommentBox): void {
		const sent = this.posting[box];
		const inPost = (image: IPendingImage) => !!image.assetId && sent.has(image.assetId);
		const kept = this.pending[box].filter(inPost);
		const unsent = this.pending[box].filter((image) => !inPost(image));
		this.dropImages(box, kept);
		this.discardImages(box, unsent);
	}

	/**
	 * Deletes uploads that no comment refers to. Deleting asks for ALL_ORG_EDIT or MEDIA_GALLERY_DELETE; without
	 * either, or on a failure, the upload stays — nothing on screen depends on it.
	 */
	private deleteAssets(ids: ID[]): void {
		for (const id of ids) {
			this.imageUrls.delete(id);
			this._imageAssets.deleteImageAsset({ id } as IImageAsset).catch(() => undefined);
		}
	}

	/**
	 * Deletes a comment once its inline confirmation is accepted. Its replies are kept: the database unlinks
	 * them (`SET NULL`), so they show as comments of their own.
	 */
	protected async deleteComment(comment: IComment): Promise<void> {
		if (this.deleting) return;
		this.deleting = true;
		try {
			await this._commentService.delete(comment.id);
			if (this.openThreadId === comment.id) this.openThreadId = null;
			this._toastr.success(this.text.deleted);
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
				entity: this.entity,
				entityId: this.entityId,
				entityName: this.entityName,
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
	 * comment at its root, and a reply whose parent is gone is shown as a comment of its own. Newest first turns
	 * the threads round; the replies inside a thread stay oldest first, as a conversation reads.
	 */
	private buildThreads(comments: IComment[]): ICommentThread[] {
		const byId = new Map(comments.map((comment) => [comment.id, comment]));
		const rootOf = (comment: IComment): IComment => {
			let seen = new Set<ID>();
			let current = comment;
			while (current.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
				seen.add(current.id);
				current = byId.get(current.parentId);
			}
			return current;
		};
		let threads = new Map<ID, ICommentThread>();
		for (const comment of comments) {
			const root = rootOf(comment);
			if (!threads.has(root.id)) {
				threads.set(root.id, { entry: this.toEntry(root), replies: [] });
			}
			if (root !== comment) {
				threads.get(root.id).replies.push(this.toEntry(comment));
			}
		}
		const ordered = [...threads.values()];
		return this.newestFirst ? ordered.reverse() : ordered;
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
		if (!this.canWrite) return false;
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
