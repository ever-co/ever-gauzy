import { type CSSProperties, type ReactNode } from 'react';
import { useInjectedStyles } from '../helpers/inject-styles';
import { themeTokens } from '../themeTokens';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
	/** Display name (rendered as a link when `onClick` is given). */
	name?: string;
	/** Image URL; when empty only the name/caption render (like `ngx-avatar`). */
	src?: string;
	/** Caption line under the name (e.g. a formatted date). */
	caption?: ReactNode;
	/** Text prepended to the caption (e.g. "Last worked:"). */
	appendCaption?: ReactNode;
	size?: AvatarSize;
	/** Presence flags — draws the green/red status dot when either is defined. */
	presence?: { isOnline?: boolean; isAway?: boolean } | null;
	/** Fired when the image or the name is clicked (Angular navigates to the employee edit page). */
	onClick?: () => void;
	/** Accessible name of the clickable image when there is no `name` (defaults to "Open profile"). */
	imageLabel?: string;
	/** Small pill after the name — the "Agent" badge `ngx-avatar` shows for agent employees. */
	badge?: ReactNode;
	/**
	 * `dashboard` = the `.avatar-dashboard` look (full-width chip, 20px image, 14px/600 name);
	 * `activity` adds the `.activity` circle variant (28px round image).
	 */
	variant?: 'dashboard' | 'activity';
	className?: string;
	style?: CSSProperties;
}

const AVATAR_CSS = `
.gzrc-avatar { display: block; width: 100%; border-radius: ${themeTokens.radius}; }
.gzrc-avatar .gzrc-avatar-inner { border-radius: 9999px; align-items: center; overflow: hidden; display: flex; gap: 8px; width: 100%; }
.gzrc-avatar .gzrc-avatar-image { cursor: pointer; border-radius: ${themeTokens.radius}; display: flex; position: relative; flex: 0 0 auto; }
.gzrc-avatar .gzrc-avatar-image img { object-fit: cover; border-radius: ${themeTokens.radius}; }
.gzrc-avatar .gzrc-avatar-image.md, .gzrc-avatar .gzrc-avatar-image.md img { width: 48px; }
.gzrc-avatar .gzrc-avatar-image.md img { height: 48px; }
.gzrc-avatar .gzrc-avatar-image.lg, .gzrc-avatar .gzrc-avatar-image.lg img { width: 64px; }
.gzrc-avatar .gzrc-avatar-image.lg img { height: 64px; }
.gzrc-avatar .gzrc-avatar-image.sm, .gzrc-avatar .gzrc-avatar-image.sm img { width: 32px; }
.gzrc-avatar .gzrc-avatar-image.sm img { height: 32px; }
/* In the dashboard chip the Angular avatar's 'common' block (20px) comes after the size rules at
   the same specificity, so every size renders at 20px there; .activity then wins with a 28px circle. */
.gzrc-avatar.dashboard .gzrc-avatar-image, .gzrc-avatar.dashboard .gzrc-avatar-image img { width: 20px; }
.gzrc-avatar.dashboard .gzrc-avatar-image img { height: 20px; }
.gzrc-avatar.activity .gzrc-avatar-image, .gzrc-avatar.activity .gzrc-avatar-image img { width: 28px; border-radius: 50%; }
.gzrc-avatar.activity .gzrc-avatar-image img { height: 28px; }
.gzrc-avatar .gzrc-avatar-status { position: absolute; width: 8px; height: 8px; border-radius: 50%; border: 2px solid ${themeTokens.card1};
	right: -1px; bottom: -1px; top: auto; box-sizing: content-box; }
.gzrc-avatar .gzrc-avatar-status.online { background-color: ${themeTokens.success}; }
.gzrc-avatar .gzrc-avatar-status.offline { background-color: ${themeTokens.text2}; }
.gzrc-avatar .gzrc-avatar-image[role='button'] { outline: none; }
.gzrc-avatar .gzrc-avatar-image[role='button']:focus-visible { box-shadow: 0 0 0 2px ${themeTokens.primary}; }
.gzrc-avatar .gzrc-avatar-names { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; width: 100%; min-width: 0; }
.gzrc-avatar .gzrc-avatar-name { display: block; cursor: pointer; text-decoration: none; font-style: normal; font-size: 14px; font-weight: 600;
	line-height: 15px; letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${themeTokens.text1}; background: none; border: 0; padding: 0; text-align: start; max-width: 100%; font-family: inherit; }
.gzrc-avatar .gzrc-avatar-name-row { display: flex; align-items: center; min-width: 0; }
.gzrc-avatar .gzrc-avatar-name-row .gzrc-avatar-name { min-width: 0; }
.gzrc-avatar .gzrc-avatar-badge { display: inline-block; flex: 0 0 auto; margin-inline-start: 4px; padding: 0 6px; border-radius: 9999px; font-size: 10px; font-weight: 600;
	line-height: 16px; text-transform: uppercase; letter-spacing: 0.02em; vertical-align: middle;
	color: var(--color-info-default, #0095ff); background-color: var(--color-info-transparent-100, rgba(0, 149, 255, 0.08)); }.gzrc-avatar .gzrc-avatar-name.static { cursor: default; }
.gzrc-avatar .gzrc-avatar-name:not(.static):hover { text-decoration: underline; }
.gzrc-avatar .gzrc-avatar-caption { font-size: 11px; font-weight: 400; line-height: 11px; letter-spacing: 0; color: ${themeTokens.text2}; }
`;

/**
 * Avatar — React port of `<ngx-avatar class="avatar-dashboard">`: image (with optional presence
 * dot) + name link + caption, sized `sm|md|lg`, in the dashboard chip layout.
 */
export function Avatar({
	name,
	src,
	imageLabel = 'Open profile',
	badge,
	caption,
	appendCaption,
	size = 'md',
	presence,
	onClick,
	variant = 'dashboard',
	className,
	style
}: AvatarProps) {
	useInjectedStyles('gzrc-avatar-styles', AVATAR_CSS);
	const online = !!presence?.isOnline && !presence?.isAway;
	// `activity` is a variant OF the dashboard chip (`class="avatar-dashboard activity"`).
	const classes = ['gzrc-avatar', 'dashboard', variant === 'activity' ? 'activity' : '', className ?? ''].filter(Boolean).join(' ');
	return (
		<div className={classes} style={style}>
			<div className="gzrc-avatar-inner">
				{src ? (
					<div
						className={`gzrc-avatar-image ${size}`}
						onClick={onClick}
						role={onClick ? 'button' : undefined}
						tabIndex={onClick ? 0 : undefined}
						aria-label={onClick ? name || imageLabel : undefined}
						onKeyDown={
							onClick
								? (event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											onClick();
										}
									}
								: undefined
						}
					>
						<img src={src} alt={name ?? ''} draggable={false} />
						{presence ? <span className={`gzrc-avatar-status ${online ? 'online' : 'offline'}`} /> : null}
					</div>
				) : null}
				<div className="gzrc-avatar-names">
					{name || badge ? (
						<div className="gzrc-avatar-name-row">
							{name ? (
								onClick ? (
									<button type="button" className="gzrc-avatar-name" title={name} onClick={onClick}>
										{name}
									</button>
								) : (
									<span className="gzrc-avatar-name static" title={name}>
										{name}
									</span>
								)
							) : null}
							{badge ? (
								<span className="gzrc-avatar-badge" title={typeof badge === 'string' ? badge : undefined}>
									{badge}
								</span>
							) : null}
						</div>
					) : null}
					{caption ? (
						<div className="gzrc-avatar-caption">
							{appendCaption ? <>{appendCaption} </> : null}
							{caption}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
