import { environment } from '@gauzy/config';

/**
 * Placeholder images (a letter or two on a colored background) for users, organizations, teams, projects, contacts and
 * tenants that have no image of their own.
 *
 * They used to be `https://dummyimage.com/...` URLs, so every browser and app that showed such a record called a third
 * party that has no legal entity, privacy policy or contract (legal audit item 7). The API now draws them itself
 * (`GET /api/placeholder/:size/:background`, see `PlaceholderImageController`), and the URLs it stores are short
 * first-party ones: `${API_BASE_URL}/api/placeholder/330x300/269aff?text=A`. They fit the 255-character `varchar`
 * columns some of them are written to on MySQL (`organization_team.logo`, `tenant.logo`) and are raster images, which
 * every client renders (React Native's `Image` does not render SVG).
 *
 * The dummyimage.com URLs already stored are replaced by the same placeholder drawn by the API, when a record is read
 * and when it is written (see {@link replaceDummyImageUrl}).
 */

/** The path the API draws placeholder images on, the global `/api` prefix included. */
export const PLACEHOLDER_IMAGE_PATH = '/api/placeholder';

/** The largest width or height a placeholder is drawn at, in pixels. */
export const PLACEHOLDER_IMAGE_MAX_SIZE = 1024;

/** The most letters or digits a placeholder shows. */
export const PLACEHOLDER_IMAGE_MAX_TEXT_LENGTH = 4;

/** The background of a placeholder that names none the API can use: the first of the generated logo colors. */
export const PLACEHOLDER_IMAGE_DEFAULT_BACKGROUND = '269aff';

/** What a placeholder image is drawn from. */
export interface PlaceholderImage {
	/** The width, in pixels: 1 to {@link PLACEHOLDER_IMAGE_MAX_SIZE}. */
	width: number;
	/** The height, in pixels: 1 to {@link PLACEHOLDER_IMAGE_MAX_SIZE}. */
	height: number;
	/** The background: 6 lowercase hex digits, without `#`. */
	background: string;
	/** The text, drawn in white: letters and digits only, at most {@link PLACEHOLDER_IMAGE_MAX_TEXT_LENGTH}. */
	text: string;
}

const HEX_COLOR = /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The size segment of a placeholder route: `<width>x<height>`. */
const PLACEHOLDER_SIZE = /^(\d{1,4})x(\d{1,4})$/;

/** The host of the former generator, at the start of a URL (`https://`, `http://` or protocol-relative). */
const DUMMY_IMAGE_HOST = /^(?:https?:)?\/\/(?:www\.)?dummyimage\.com(?=[/?#&]|$)/i;

/** The path of a dummyimage.com URL: `/<width>[x<height>][/<background>[/<foreground>][.<format>]]`. */
const DUMMY_IMAGE_SIZE_AND_BACKGROUND = /^\/(\d{1,5})(?:x(\d{1,5}))?(?:\/([0-9a-f]{6}|[0-9a-f]{3})(?=[/.?&#]|$))?/i;

/** The text of a dummyimage.com URL, which takes it after `&` as often as after `?`. */
const DUMMY_IMAGE_TEXT = /[?&]text(?:=([^&#]*))?/i;

/**
 * The text a placeholder shows: the letters and digits of `text`, at most {@link PLACEHOLDER_IMAGE_MAX_TEXT_LENGTH}.
 *
 * @param text - Any value; anything but a string gives no text.
 */
export function normalizePlaceholderText(text: unknown): string {
	if (typeof text !== 'string') {
		return '';
	}
	return Array.from(text.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, ''))
		.slice(0, PLACEHOLDER_IMAGE_MAX_TEXT_LENGTH)
		.join('');
}

/**
 * A placeholder background as 6 lowercase hex digits, or `undefined` when `color` is not 3 or 6 hex digits.
 *
 * @param color - The color, without `#`.
 */
export function normalizePlaceholderBackground(color: unknown): string | undefined {
	if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
		return undefined;
	}
	const hex = color.toLowerCase();
	return hex.length === 3 ? hex.replace(/./g, (digit) => digit + digit) : hex;
}

/**
 * A width or height a placeholder can be drawn at: a whole number from 1 to {@link PLACEHOLDER_IMAGE_MAX_SIZE}.
 *
 * @param size - The size asked for, in pixels.
 * @param fallback - The size when `size` is not a number.
 */
function placeholderSize(size: number, fallback: number): number {
	const pixels = Number.isFinite(size) ? Math.trunc(size) : fallback;
	return Math.min(PLACEHOLDER_IMAGE_MAX_SIZE, Math.max(1, pixels));
}

/**
 * The URL of a placeholder image the API draws: `text` in white on `background`.
 *
 * @param width - The width, in pixels.
 * @param height - The height, in pixels.
 * @param background - The background, as 3 or 6 hex digits without `#`; another value gives the default one.
 * @param text - The text, usually initials; only its letters and digits are kept.
 * @param baseUrl - The API's own URL. Default: `API_BASE_URL`.
 */
export function getPlaceholderImageUrl(
	width: number,
	height: number,
	background: string,
	text: string,
	baseUrl: string = environment.baseUrl
): string {
	const size = `${placeholderSize(width, 330)}x${placeholderSize(height, 300)}`;
	const color = normalizePlaceholderBackground(background) ?? PLACEHOLDER_IMAGE_DEFAULT_BACKGROUND;
	const label = normalizePlaceholderText(text);
	const query = label ? `?text=${encodeURIComponent(label)}` : '';
	return `${(baseUrl ?? '').replace(/\/+$/, '')}${PLACEHOLDER_IMAGE_PATH}/${size}/${color}${query}`;
}

/**
 * The placeholder a request of the placeholder route asks for, or `undefined` when its size or background is not one
 * the route draws (the route answers 400).
 *
 * @param size - The size segment: `<width>x<height>`, each from 1 to {@link PLACEHOLDER_IMAGE_MAX_SIZE}.
 * @param background - The background segment: 3 or 6 hex digits.
 * @param text - The `text` query parameter; a repeated one counts by its first value.
 */
export function parsePlaceholderImage(size: string, background: string, text?: unknown): PlaceholderImage | undefined {
	const match = PLACEHOLDER_SIZE.exec(size ?? '');
	const color = normalizePlaceholderBackground(background);
	if (!match || !color) {
		return undefined;
	}
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (width < 1 || height < 1 || width > PLACEHOLDER_IMAGE_MAX_SIZE || height > PLACEHOLDER_IMAGE_MAX_SIZE) {
		return undefined;
	}
	return {
		width,
		height,
		background: color,
		text: normalizePlaceholderText(Array.isArray(text) ? text[0] : text)
	};
}

/**
 * Whether `value` is a placeholder URL of the former generator, `https://dummyimage.com/...`.
 *
 * @param value - Any value.
 */
export function isDummyImageUrl(value: unknown): value is string {
	return typeof value === 'string' && DUMMY_IMAGE_HOST.test(value.trim());
}

/**
 * Replaces a placeholder URL of the former generator (`https://dummyimage.com/330x300/269aff/ffffff.jpg&text=A`,
 * stored in many existing rows) by the same placeholder drawn by the API, so that showing a record never calls that
 * third party. Any other value is returned as it is.
 *
 * A dummyimage.com URL whose size or color cannot be read still gets a first-party placeholder (330x300, the default
 * background).
 *
 * @param value - An image URL as stored.
 */
export function withoutDummyImageHost<T>(value: T): T | string {
	if (!isDummyImageUrl(value)) {
		return value;
	}
	const url = value.trim();
	const path = url.slice(DUMMY_IMAGE_HOST.exec(url)[0].length);
	const [, width, height, background] = DUMMY_IMAGE_SIZE_AND_BACKGROUND.exec(path) ?? [];
	const [, text = ''] = DUMMY_IMAGE_TEXT.exec(path) ?? [];

	let label = text.replace(/\+/g, ' ');
	try {
		label = decodeURIComponent(label);
	} catch {
		// A malformed escape: the letters that can be read are kept.
	}

	return getPlaceholderImageUrl(
		width ? Number(width) : 330,
		height ? Number(height) : width ? Number(width) : 300,
		background,
		label
	);
}

/**
 * Replaces a dummyimage.com URL stored in `entity[field]` by the first-party placeholder (see
 * {@link withoutDummyImageHost}). Leaves the entity untouched otherwise: a partial entity of an update gets no field it
 * did not have.
 *
 * @param entity - The entity, as loaded or about to be written.
 * @param field - The field holding the image URL (`imageUrl`, `logo`).
 */
export function replaceDummyImageUrl<T extends object>(entity: T, field: keyof T & string): void {
	const value = entity?.[field];
	if (isDummyImageUrl(value)) {
		entity[field] = withoutDummyImageHost(value) as T[keyof T & string];
	}
}
