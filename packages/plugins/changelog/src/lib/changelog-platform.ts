import { BadRequestException } from '@nestjs/common';
import {
	CHANGELOG_PLATFORM_MAX_LENGTH,
	CHANGELOG_PLATFORM_PATTERN,
	DEFAULT_CHANGELOG_PLATFORM
} from '@gauzy/contracts';

/**
 * A product key as stored: trimmed and lowercased, so `Ever-Teams ` and `ever-teams` name the same product.
 * Anything that is not a string passes through untouched, for the validators to refuse.
 */
export function toChangelogPlatformKey(value: unknown): unknown {
	return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/** Whether `value` is a product key the `changelog.platform` column takes. */
export function isChangelogPlatformKey(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= CHANGELOG_PLATFORM_MAX_LENGTH &&
		CHANGELOG_PLATFORM_PATTERN.test(value)
	);
}

/**
 * The product a written entry belongs to. Absent or blank names Gauzy (when `fallback` is given, as on create)
 * or leaves the stored product as it is (no fallback, as on update: `undefined` is not written). A value that
 * is not a product key is refused with 400 instead of being stored where no reader would ever ask for it.
 */
export function resolveChangelogPlatform(value: unknown, fallback?: string): string | undefined {
	const key = toChangelogPlatformKey(value);
	if (key === undefined || key === null || key === '') {
		return fallback;
	}
	if (!isChangelogPlatformKey(key)) {
		throw new BadRequestException(
			`"platform" must be a product key of lowercase letters, digits and hyphens (such as "${DEFAULT_CHANGELOG_PLATFORM}"), at most ${CHANGELOG_PLATFORM_MAX_LENGTH} characters.`
		);
	}
	return key;
}
