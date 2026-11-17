import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	inject,
	Input,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

/** Side, in pixels, of the square photo the dialog produces. */
export const AVATAR_OUTPUT_SIZE = 512;

/** How far past the "just covers the circle" size the photo can be zoomed. */
const MAX_ZOOM = 4;

/** Space, in pixels, kept between the circle and the edge of the stage. */
const CIRCLE_INSET = 16;

/** How far, in pixels, one arrow key press moves the photo. */
const KEY_STEP = 10;

/**
 * Lets a person frame a photo inside a circle before it becomes their avatar: drag to move it, the slider
 * (or the mouse wheel) to zoom. Closes with the framed square as a JPEG `File`, or with nothing when
 * cancelled.
 *
 * The circle is only a guide. The saved photo is the square around it, so a client that shows avatars
 * as squares still gets the framed picture.
 */
@Component({
	selector: 'ga-avatar-crop-dialog',
	templateUrl: './avatar-crop-dialog.component.html',
	styleUrls: ['./avatar-crop-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbCardModule, NbButtonModule, NbIconModule, TranslatePipe]
})
export class AvatarCropDialogComponent implements OnInit, OnDestroy {
	private readonly dialogRef = inject<NbDialogRef<AvatarCropDialogComponent>>(NbDialogRef);
	private readonly cdr = inject(ChangeDetectorRef);

	/** The picked image file. */
	@Input() file: File;

	@ViewChild('stage', { static: true }) stageRef: ElementRef<HTMLElement>;

	objectUrl: string;
	ready = false;
	saving = false;

	/** Zoom on top of the scale that just covers the circle: 1 to {@link MAX_ZOOM}. */
	zoom = 1;
	readonly minZoom = 1;
	readonly maxZoom = MAX_ZOOM;

	/** Offset, in stage pixels, of the photo's top-left corner. */
	x = 0;
	y = 0;

	private image: HTMLImageElement;
	private stageSize = 0;
	private baseScale = 1;
	/** The pointer moving the photo, while one is. */
	drag: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null = null;

	get scale(): number {
		return this.baseScale * this.zoom;
	}

	get circleSize(): number {
		return Math.max(this.stageSize - CIRCLE_INSET * 2, 0);
	}

	get imageTransform(): string {
		return `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
	}

	ngOnInit(): void {
		this.objectUrl = URL.createObjectURL(this.file);
	}

	/**
	 * The photo has decoded: size it so it just covers the circle and centre it.
	 */
	onImageLoad(event: Event): void {
		this.image = event.target as HTMLImageElement;
		this.stageSize = this.stageRef.nativeElement.clientWidth;
		const { naturalWidth: width, naturalHeight: height } = this.image;
		this.baseScale = this.circleSize / Math.min(width, height);
		this.zoom = 1;
		this.x = (this.stageSize - width * this.scale) / 2;
		this.y = (this.stageSize - height * this.scale) / 2;
		this.ready = true;
		this.cdr.markForCheck();
	}

	/** The browser could not decode the file (a HEIC photo, a renamed document…). */
	onImageError(): void {
		this.dialogRef.close({ error: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.UNSUPPORTED' });
	}

	onPointerDown(event: PointerEvent): void {
		if (!this.ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		this.drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: this.x,
			originY: this.y
		};
		event.preventDefault();
	}

	onPointerMove(event: PointerEvent): void {
		if (!this.drag || this.drag.pointerId !== event.pointerId) return;
		this.moveTo(
			this.drag.originX + event.clientX - this.drag.startX,
			this.drag.originY + event.clientY - this.drag.startY
		);
	}

	onPointerUp(event: PointerEvent): void {
		if (this.drag?.pointerId === event.pointerId) {
			this.drag = null;
		}
	}

	onWheel(event: WheelEvent): void {
		if (!this.ready) return;
		event.preventDefault();
		this.setZoom(this.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
	}

	onKeydown(event: KeyboardEvent): void {
		if (!this.ready) return;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [KEY_STEP, 0],
			ArrowRight: [-KEY_STEP, 0],
			ArrowUp: [0, KEY_STEP],
			ArrowDown: [0, -KEY_STEP]
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			this.moveTo(this.x + move[0], this.y + move[1]);
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			this.setZoom(this.zoom + 0.1);
		} else if (event.key === '-') {
			event.preventDefault();
			this.setZoom(this.zoom - 0.1);
		}
	}

	onZoomInput(event: Event): void {
		this.setZoom(Number((event.target as HTMLInputElement).value));
	}

	zoomBy(step: number): void {
		this.setZoom(this.zoom + step);
	}

	/**
	 * Zooms around the centre of the circle, so what is in the middle stays in the middle.
	 */
	setZoom(value: number): void {
		if (!this.ready) return;
		const next = Math.min(Math.max(value, this.minZoom), this.maxZoom);
		const centre = this.stageSize / 2;
		const ratio = next / this.zoom;
		this.zoom = next;
		this.moveTo(centre - (centre - this.x) * ratio, centre - (centre - this.y) * ratio);
	}

	cancel(): void {
		this.dialogRef.close();
	}

	/**
	 * Draws the square around the circle into a {@link AVATAR_OUTPUT_SIZE} canvas and closes with it as a JPEG.
	 * A transparent photo is laid on white, since JPEG has no transparency. Closes with an error when the photo
	 * cannot be drawn, so the page waiting on the dialog always hears back.
	 */
	async save(): Promise<void> {
		if (!this.ready || this.saving) return;
		this.saving = true;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = AVATAR_OUTPUT_SIZE;
			const context = canvas.getContext('2d');
			if (!context) {
				throw new Error('The photo could not be drawn.');
			}
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
			context.imageSmoothingQuality = 'high';

			const sourceX = (CIRCLE_INSET - this.x) / this.scale;
			const sourceY = (CIRCLE_INSET - this.y) / this.scale;
			const sourceSize = this.circleSize / this.scale;
			context.drawImage(
				this.image,
				sourceX,
				sourceY,
				sourceSize,
				sourceSize,
				0,
				0,
				AVATAR_OUTPUT_SIZE,
				AVATAR_OUTPUT_SIZE
			);

			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
			if (!blob) {
				this.dialogRef.close({ error: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.UNSUPPORTED' });
				return;
			}
			const name = (this.file.name.replace(/\.[^.]+$/, '') || 'avatar') + '.jpg';
			this.dialogRef.close({ file: new File([blob], name, { type: 'image/jpeg' }) });
		} catch {
			this.dialogRef.close({ error: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.UNSUPPORTED' });
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Moves the photo, keeping it over the whole circle: no empty corner can show inside the frame.
	 */
	private moveTo(x: number, y: number): void {
		const inset = CIRCLE_INSET;
		const far = inset + this.circleSize;
		const width = this.image.naturalWidth * this.scale;
		const height = this.image.naturalHeight * this.scale;
		this.x = Math.min(inset, Math.max(far - width, x));
		this.y = Math.min(inset, Math.max(far - height, y));
		this.cdr.markForCheck();
	}

	ngOnDestroy(): void {
		if (this.objectUrl) {
			URL.revokeObjectURL(this.objectUrl);
		}
	}
}
