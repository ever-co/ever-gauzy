import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	AVATAR_BACKGROUNDS,
	AVATAR_CLOTHES,
	AVATAR_CLOTHES_COLORS,
	AVATAR_EXPRESSIONS,
	AVATAR_FACIAL_HAIR,
	AVATAR_GLASSES,
	AVATAR_HAIR_COLORS,
	AVATAR_HAIR_STYLES,
	AVATAR_HEADWEAR,
	AVATAR_PRESET_GROUPS,
	AVATAR_PRINTS,
	AVATAR_SKIN_TONES,
	AvatarOptions,
	avatarDataUrl,
	randomAvatar,
	renderAvatarSvg
} from './avatar-art';

/** Side, in pixels, of the square picture an avatar is saved as. */
const AVATAR_PNG_SIZE = 512;

/** One part of the avatar the person can change. */
interface AvatarPart {
	key: keyof AvatarOptions;
	label: string;
	/** Colors show as swatches; styles show as small avatars wearing that style. */
	kind: 'color' | 'style';
	values: string[];
}

const PARTS: AvatarPart[] = [
	{ key: 'skin', label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.SKIN', kind: 'color', values: AVATAR_SKIN_TONES },
	{
		key: 'expression',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.EXPRESSION',
		kind: 'style',
		values: AVATAR_EXPRESSIONS
	},
	{ key: 'hair', label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.HAIR', kind: 'style', values: AVATAR_HAIR_STYLES },
	{
		key: 'hairColor',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.HAIR_COLOR',
		kind: 'color',
		values: AVATAR_HAIR_COLORS
	},
	{
		key: 'facialHair',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.FACIAL_HAIR',
		kind: 'style',
		values: AVATAR_FACIAL_HAIR
	},
	{ key: 'glasses', label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.GLASSES', kind: 'style', values: AVATAR_GLASSES },
	{ key: 'headwear', label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.HEADWEAR', kind: 'style', values: AVATAR_HEADWEAR },
	{ key: 'clothes', label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.CLOTHES', kind: 'style', values: AVATAR_CLOTHES },
	{ key: 'print', label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.PRINT', kind: 'style', values: AVATAR_PRINTS },
	{
		key: 'clothesColor',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.CLOTHES_COLOR',
		kind: 'color',
		values: AVATAR_CLOTHES_COLORS
	},
	{
		key: 'background',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.BACKGROUND',
		kind: 'color',
		values: AVATAR_BACKGROUNDS
	}
];

/** A choice in a part's row: its value, and the small avatar that shows it (for a style). */
interface AvatarChoice {
	value: string;
	preview?: string;
}

/**
 * The avatar maker: a ready-made illustrated avatar to start from, then each part — skin tone, hair, facial
 * hair, glasses, clothes, background — to change. Closes with the avatar as a PNG `File`, or with nothing when
 * cancelled.
 */
@Component({
	selector: 'ga-avatar-maker-dialog',
	templateUrl: './avatar-maker-dialog.component.html',
	styleUrls: ['./avatar-maker-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [NbCardModule, NbButtonModule, NbIconModule, TranslatePipe]
})
export class AvatarMakerDialogComponent {
	readonly parts = PARTS;

	options: AvatarOptions = { ...AVATAR_PRESET_GROUPS[0].presets[0] };
	/** The ready-made avatar chosen, as `<group>-<index>`, until a part of it is changed. */
	selectedPreset: string | null = `${AVATAR_PRESET_GROUPS[0].key}-0`;
	saving = false;

	preview: string;
	/** The ready-made avatars, by group (everyday, for developers, fun), with their pictures. */
	readonly presetGroups = AVATAR_PRESET_GROUPS.map((group) => ({
		key: group.key,
		label: group.label,
		presets: group.presets.map((options, index) => ({
			id: `${group.key}-${index}`,
			options,
			url: avatarDataUrl(options)
		}))
	}));
	/** The choices of each part, keyed by the part; a style's small avatars follow the rest of the options. */
	choices: Record<string, AvatarChoice[]> = {};

	constructor(private readonly dialogRef: NbDialogRef<AvatarMakerDialogComponent>) {
		this.refresh();
	}

	choosePreset(preset: { id: string; options: AvatarOptions }): void {
		this.options = { ...preset.options };
		this.selectedPreset = preset.id;
		this.refresh();
	}

	choose(part: AvatarPart, value: string): void {
		this.options = { ...this.options, [part.key]: value };
		this.selectedPreset = null;
		this.refresh();
	}

	isChosen(part: AvatarPart, value: string): boolean {
		return this.options[part.key] === value;
	}

	shuffle(): void {
		this.options = randomAvatar();
		this.selectedPreset = null;
		this.refresh();
	}

	cancel(): void {
		this.dialogRef.close();
	}

	/**
	 * Draws the avatar into a {@link AVATAR_PNG_SIZE} square PNG (the server stores raster images only) and closes
	 * with it.
	 */
	async save(): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		const url = URL.createObjectURL(new Blob([renderAvatarSvg(this.options)], { type: 'image/svg+xml' }));
		try {
			const image = new Image();
			await new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = () => reject(new Error('The avatar could not be drawn.'));
				image.src = url;
			});
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = AVATAR_PNG_SIZE;
			canvas.getContext('2d').drawImage(image, 0, 0, AVATAR_PNG_SIZE, AVATAR_PNG_SIZE);
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
			if (!blob) {
				throw new Error('The avatar could not be drawn.');
			}
			this.dialogRef.close({ file: new File([blob], 'avatar.png', { type: 'image/png' }) });
		} catch {
			this.dialogRef.close({ error: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.UNSUPPORTED' });
		} finally {
			URL.revokeObjectURL(url);
			this.saving = false;
		}
	}

	/** Redraws the preview and the small avatars of every style, from the current options. */
	private refresh(): void {
		this.preview = avatarDataUrl(this.options);
		const choices: Record<string, AvatarChoice[]> = {};
		for (const part of this.parts) {
			choices[part.key] = part.values.map((value) => ({
				value,
				preview: part.kind === 'style' ? avatarDataUrl({ ...this.options, [part.key]: value }) : undefined
			}));
		}
		this.choices = choices;
	}
}
