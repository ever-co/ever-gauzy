/**
 * Flat, illustrated avatars drawn as SVG from a handful of parts: skin tone, expression, hair style and color,
 * facial hair, glasses, headwear, clothes, a print on the shirt and the background. Pure functions with no Angular
 * or DOM dependency, so the same options always draw the same picture.
 */

export type AvatarHairStyle = 'none' | 'short' | 'quiff' | 'side' | 'curly' | 'long' | 'bun';
export type AvatarExpression = 'smile' | 'grin' | 'wink' | 'tongue' | 'surprised' | 'laugh';
export type AvatarFacialHair = 'none' | 'stubble' | 'mustache' | 'handlebar' | 'beard';
export type AvatarGlasses = 'none' | 'round' | 'square' | 'shades';
export type AvatarHeadwear = 'none' | 'headphones' | 'beanie' | 'cap' | 'party' | 'crown';
export type AvatarClothes = 'crew' | 'collar' | 'suit' | 'hoodie';
export type AvatarPrint = 'none' | 'code' | 'terminal' | 'bug';

export interface AvatarOptions {
	skin: string;
	expression: AvatarExpression;
	hair: AvatarHairStyle;
	hairColor: string;
	facialHair: AvatarFacialHair;
	glasses: AvatarGlasses;
	headwear: AvatarHeadwear;
	clothes: AvatarClothes;
	print: AvatarPrint;
	clothesColor: string;
	background: string;
}

export const AVATAR_SKIN_TONES = ['#f9d9c4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
export const AVATAR_HAIR_COLORS = ['#2c1b12', '#4a2c1a', '#7b4a26', '#c58f4f', '#e6c27a', '#9e9e9e', '#a8432a'];
export const AVATAR_CLOTHES_COLORS = ['#2f4b7c', '#2a9d8f', '#e76f51', '#264653', '#6d597a', '#e9b949', '#3a86ff', '#2b2b2b'];
export const AVATAR_BACKGROUNDS = ['#d6ecf3', '#dcf5e3', '#fdeec4', '#fbdbe7', '#e6e8ec', '#d9dcfb', '#fde0c8', '#2bb3a8'];
export const AVATAR_EXPRESSIONS: AvatarExpression[] = ['smile', 'grin', 'wink', 'tongue', 'surprised', 'laugh'];
export const AVATAR_HAIR_STYLES: AvatarHairStyle[] = ['short', 'quiff', 'side', 'curly', 'long', 'bun', 'none'];
export const AVATAR_FACIAL_HAIR: AvatarFacialHair[] = ['none', 'stubble', 'mustache', 'handlebar', 'beard'];
export const AVATAR_GLASSES: AvatarGlasses[] = ['none', 'round', 'square', 'shades'];
export const AVATAR_HEADWEAR: AvatarHeadwear[] = ['none', 'headphones', 'beanie', 'cap', 'party', 'crown'];
export const AVATAR_CLOTHES: AvatarClothes[] = ['crew', 'collar', 'suit', 'hoodie'];
export const AVATAR_PRINTS: AvatarPrint[] = ['none', 'code', 'terminal', 'bug'];

const DEFAULTS: AvatarOptions = {
	skin: AVATAR_SKIN_TONES[1],
	expression: 'smile',
	hair: 'short',
	hairColor: AVATAR_HAIR_COLORS[0],
	facialHair: 'none',
	glasses: 'none',
	headwear: 'none',
	clothes: 'crew',
	print: 'none',
	clothesColor: AVATAR_CLOTHES_COLORS[0],
	background: AVATAR_BACKGROUNDS[0]
};

const avatar = (options: Partial<AvatarOptions>): AvatarOptions => ({ ...DEFAULTS, ...options });

/** Ready-made avatars, offered first in groups; each one can then be changed part by part. */
export const AVATAR_PRESET_GROUPS: { key: string; label: string; presets: AvatarOptions[] }[] = [
	{
		key: 'everyday',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.PRESETS',
		presets: [
			avatar({ skin: '#f1c27d', hair: 'quiff', facialHair: 'stubble', clothes: 'collar', background: '#2bb3a8' }),
			avatar({ skin: '#f9d9c4', hair: 'long', hairColor: '#7b4a26', clothesColor: '#e76f51', background: '#fbdbe7' }),
			avatar({ skin: '#e0ac69', hair: 'side', facialHair: 'beard', glasses: 'square', clothesColor: '#264653', background: '#e6e8ec' }),
			avatar({ skin: '#8d5524', hair: 'curly', clothesColor: '#e9b949', background: '#d6ecf3' }),
			avatar({ skin: '#f9d9c4', hair: 'bun', hairColor: '#c58f4f', glasses: 'round', clothes: 'collar', clothesColor: '#6d597a', background: '#dcf5e3' }),
			avatar({ skin: '#c68642', facialHair: 'mustache', clothes: 'suit', clothesColor: '#2b2b2b', background: '#fdeec4' }),
			avatar({ hair: 'side', hairColor: '#e6c27a', clothesColor: '#3a86ff', background: '#d9dcfb' }),
			avatar({ skin: '#5c3a21', hair: 'none', facialHair: 'beard', clothes: 'collar', clothesColor: '#2a9d8f', background: '#fde0c8' }),
			avatar({ skin: '#e0ac69', hair: 'long', glasses: 'round', clothesColor: '#2a9d8f', background: '#d6ecf3' }),
			avatar({ skin: '#f9d9c4', hairColor: '#9e9e9e', facialHair: 'beard', glasses: 'square', clothes: 'suit', clothesColor: '#264653', background: '#e6e8ec' }),
			avatar({ skin: '#c68642', hair: 'curly', hairColor: '#4a2c1a', clothes: 'collar', clothesColor: '#e76f51', background: '#dcf5e3' }),
			avatar({ hair: 'quiff', hairColor: '#a8432a', facialHair: 'stubble', glasses: 'round', clothesColor: '#6d597a', background: '#fdeec4' })
		]
	},
	{
		key: 'developers',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.DEVELOPERS',
		presets: [
			avatar({ hair: 'side', glasses: 'square', headwear: 'headphones', clothes: 'hoodie', print: 'code', clothesColor: '#2b2b2b', background: '#d9dcfb' }),
			avatar({ skin: '#e0ac69', facialHair: 'beard', glasses: 'round', headwear: 'beanie', clothes: 'hoodie', print: 'terminal', clothesColor: '#264653', background: '#dcf5e3' }),
			avatar({ skin: '#f9d9c4', hair: 'long', hairColor: '#a8432a', glasses: 'round', headwear: 'headphones', print: 'bug', clothesColor: '#2a9d8f', background: '#fdeec4' }),
			avatar({ skin: '#8d5524', hair: 'curly', expression: 'grin', headwear: 'cap', print: 'code', clothesColor: '#3a86ff', background: '#d6ecf3' }),
			avatar({ skin: '#c68642', hair: 'bun', glasses: 'square', clothes: 'hoodie', print: 'code', clothesColor: '#6d597a', background: '#e6e8ec' }),
			avatar({ skin: '#f1c27d', hair: 'quiff', hairColor: '#4a2c1a', facialHair: 'stubble', expression: 'surprised', print: 'bug', clothesColor: '#e76f51', background: '#fbdbe7' })
		]
	},
	{
		key: 'fun',
		label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.FUN',
		presets: [
			avatar({ expression: 'laugh', headwear: 'party', clothesColor: '#e76f51', background: '#fdeec4' }),
			avatar({ skin: '#8d5524', hair: 'none', expression: 'wink', glasses: 'shades', facialHair: 'beard', clothesColor: '#2b2b2b', background: '#2bb3a8' }),
			avatar({ skin: '#f9d9c4', hairColor: '#9e9e9e', facialHair: 'handlebar', expression: 'surprised', clothes: 'suit', clothesColor: '#6d597a', background: '#fbdbe7' }),
			avatar({ skin: '#e0ac69', hair: 'long', hairColor: '#e6c27a', expression: 'tongue', glasses: 'shades', clothesColor: '#3a86ff', background: '#d6ecf3' }),
			avatar({ skin: '#c68642', hair: 'curly', expression: 'grin', headwear: 'crown', clothes: 'collar', clothesColor: '#e9b949', background: '#d9dcfb' }),
			avatar({ hair: 'quiff', hairColor: '#a8432a', expression: 'wink', facialHair: 'handlebar', headwear: 'party', clothesColor: '#2a9d8f', background: '#dcf5e3' })
		]
	}
];

/** A random avatar, from the same parts the maker offers. */
export function randomAvatar(random: () => number = Math.random): AvatarOptions {
	const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];
	// Headwear and prints are the extras: most random avatars go without, so a shuffle still looks like a person.
	const sometimes = <T>(list: T[]): T => (random() < 0.35 ? pick(list.slice(1)) : list[0]);
	return {
		skin: pick(AVATAR_SKIN_TONES),
		expression: pick(AVATAR_EXPRESSIONS),
		hair: pick(AVATAR_HAIR_STYLES),
		hairColor: pick(AVATAR_HAIR_COLORS),
		facialHair: pick(AVATAR_FACIAL_HAIR),
		glasses: pick(AVATAR_GLASSES),
		headwear: sometimes(AVATAR_HEADWEAR),
		clothes: pick(AVATAR_CLOTHES),
		print: sometimes(AVATAR_PRINTS),
		clothesColor: pick(AVATAR_CLOTHES_COLORS),
		background: pick(AVATAR_BACKGROUNDS)
	};
}

/**
 * Lightens (positive `amount`) or darkens (negative) a `#rrggbb` color by a fraction from -1 to 1.
 */
export function shade(hex: string, amount: number): string {
	const value = parseInt(hex.slice(1), 16);
	const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
		const target = amount < 0 ? 0 : 255;
		return Math.round(channel + (target - channel) * Math.abs(amount));
	});
	return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

/** The avatar as a standalone, square SVG document (a 200 × 200 view box). */
export function renderAvatarSvg(input: AvatarOptions): string {
	const options = { ...DEFAULTS, ...input };
	const { skin, hairColor } = options;
	const skinShadow = shade(skin, -0.14);
	const skinLine = shade(skin, -0.32);
	const browColor = options.hair === 'none' && options.facialHair === 'none' ? shade(skin, -0.5) : hairColor;

	const parts = [
		backHair(options),
		body(options, skinShadow),
		shirtPrint(options),
		// Ears, then the face over them.
		`<ellipse cx="62" cy="98" rx="8" ry="11" fill="${skin}"/>`,
		`<ellipse cx="138" cy="98" rx="8" ry="11" fill="${skin}"/>`,
		`<ellipse cx="62" cy="98" rx="3.5" ry="6" fill="${skinShadow}"/>`,
		`<ellipse cx="138" cy="98" rx="3.5" ry="6" fill="${skinShadow}"/>`,
		`<path d="M62 92 C62 62 80 50 100 50 C120 50 138 62 138 92 C138 121 122 140 100 140 C78 140 62 121 62 92 Z" fill="${skin}"/>`,
		facialHair(options),
		// Cheeks.
		`<circle cx="77" cy="109" r="6" fill="#f2847a" opacity="0.16"/>`,
		`<circle cx="123" cy="109" r="6" fill="#f2847a" opacity="0.16"/>`,
		brows(options.expression, browColor),
		eyes(options.expression),
		// Nose.
		`<path d="M100 99 Q95.5 109 101 111" stroke="${skinLine}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
		mouth(options.expression),
		frontHair(options),
		glasses(options),
		headwear(options)
	];

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
		`<rect width="200" height="200" fill="${options.background}"/>` +
		// Drawn a little larger than the view box, so the figure fills the frame: the face stays centered and
		// the shoulders run off the bottom edge.
		`<g transform="translate(-12 -2) scale(1.12)">` +
		parts.filter(Boolean).join('') +
		`</g></svg>`
	);
}

/** The avatar as a `data:` URL, for an `<img>`. */
export function avatarDataUrl(options: AvatarOptions): string {
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderAvatarSvg(options));
}

/** Hair that sits behind the head: the length of long hair, a bun. */
function backHair({ hair, hairColor, headwear }: AvatarOptions): string {
	switch (hair) {
		case 'long':
			return `<path d="M58 96 C54 58 76 40 100 40 C124 40 146 58 142 96 L146 156 C140 168 122 166 118 152 L82 152 C78 166 60 168 54 156 Z" fill="${shade(hairColor, -0.12)}"/>`;
		case 'bun':
			// A hat sits where the bun would be.
			return headwear === 'none' || headwear === 'headphones'
				? `<circle cx="100" cy="40" r="17" fill="${hairColor}"/>`
				: '';
		default:
			return '';
	}
}

/** Shoulders, neck and clothes. */
function body({ clothes, clothesColor, skin }: AvatarOptions, skinShadow: string): string {
	const shoulders = `<path d="M26 200 C26 166 54 146 100 146 C146 146 174 166 174 200 Z" fill="${clothesColor}"/>`;
	const neck = `<path d="M86 120 L86 146 C86 156 114 156 114 146 L114 120 Z" fill="${skinShadow}"/>`;
	switch (clothes) {
		case 'collar':
			return [
				shoulders,
				`<path d="M86 146 L100 170 L114 146 Z" fill="${skin}"/>`,
				neck,
				`<path d="M84 143 L100 170 L78 162 L80 146 Z" fill="${shade(clothesColor, 0.28)}"/>`,
				`<path d="M116 143 L100 170 L122 162 L120 146 Z" fill="${shade(clothesColor, 0.28)}"/>`
			].join('');
		case 'suit':
			return [
				shoulders,
				`<path d="M84 146 L100 200 L116 146 Z" fill="#f4f4f4"/>`,
				neck,
				`<path d="M95 152 L105 152 L107 182 L100 192 L93 182 Z" fill="#c0392b"/>`,
				`<path d="M84 145 L100 190 L72 166 L76 150 Z" fill="${shade(clothesColor, -0.18)}"/>`,
				`<path d="M116 145 L100 190 L128 166 L124 150 Z" fill="${shade(clothesColor, -0.18)}"/>`
			].join('');
		case 'hoodie': {
			const hood = shade(clothesColor, -0.2);
			const cord = shade(clothesColor, 0.55);
			return [
				shoulders,
				neck,
				// The hood, lying around the neck.
				`<path d="M68 152 C66 136 82 132 100 132 C118 132 134 136 132 152 C124 146 112 144 100 144 C88 144 76 146 68 152 Z" fill="${hood}"/>`,
				`<path d="M80 150 C86 160 114 160 120 150" stroke="${hood}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
				// Drawstrings.
				`<path d="M92 156 L90 176 M108 156 L110 176" stroke="${cord}" stroke-width="2" stroke-linecap="round"/>`,
				`<circle cx="90" cy="177" r="2" fill="${cord}"/><circle cx="110" cy="177" r="2" fill="${cord}"/>`
			].join('');
		}
		case 'crew':
		default:
			return [
				shoulders,
				neck,
				`<path d="M84 147 C88 159 112 159 116 147" stroke="${shade(clothesColor, -0.22)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
			].join('');
	}
}

/**
 * A small logo on the chest, where a shirt carries one. Drawn up and in from the coordinates below, so it stays
 * inside the round frame.
 */
function shirtPrint(options: AvatarOptions): string {
	const logo = shirtLogo(options);
	return logo ? `<g transform="translate(-13 -9)">${logo}</g>` : '';
}

function shirtLogo({ print, clothesColor }: AvatarOptions): string {
	const ink = shade(clothesColor, 0.7);
	const line = `stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
	switch (print) {
		case 'code':
			return `<path d="M128 165 L123 170 L128 175 M140 165 L145 170 L140 175 M136 163 L132 177" ${line}/>`;
		case 'terminal':
			return [
				`<rect x="123" y="162" width="23" height="16" rx="3" fill="#1e1e1e" stroke="${ink}" stroke-width="1"/>`,
				`<path d="M127 166 L131 170 L127 174" stroke="#4ade80" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
				`<path d="M133 174 L139 174" stroke="#4ade80" stroke-width="1.8" stroke-linecap="round"/>`
			].join('');
		case 'bug':
			return [
				`<path d="M129.5 168 L126 166 M129.5 171 L125.5 171 M129.5 174 L126 176 M138.5 168 L142 166 M138.5 171 L142.5 171 M138.5 174 L142 176 M132.5 162 L131 159 M135.5 162 L137 159" stroke="${ink}" stroke-width="1.3" stroke-linecap="round"/>`,
				`<ellipse cx="134" cy="171" rx="4.6" ry="5.6" fill="${ink}"/>`,
				`<circle cx="134" cy="164" r="2.6" fill="${ink}"/>`,
				`<path d="M134 166.5 L134 176.5" stroke="${clothesColor}" stroke-width="1"/>`
			].join('');
		case 'none':
		default:
			return '';
	}
}

function brows(expression: AvatarExpression, color: string): string {
	// Raised for surprise, the usual arch otherwise.
	const lift = expression === 'surprised' ? -4 : 0;
	const stroke = `stroke="${color}" stroke-width="3.4" stroke-linecap="round" fill="none"`;
	return (
		`<path d="M76 ${85 + lift} Q85 ${80 + lift} 93 ${84 + lift}" ${stroke}/>` +
		`<path d="M107 ${84 + lift} Q115 ${80 + lift} 124 ${85 + lift}" ${stroke}/>`
	);
}

function eyes(expression: AvatarExpression): string {
	const open = (cx: number, rx = 4, ry = 4.6) =>
		`<ellipse cx="${cx}" cy="95" rx="${rx}" ry="${ry}" fill="#2b2b2b"/><circle cx="${cx + 1.4}" cy="93.4" r="1.3" fill="#ffffff"/>`;
	const closed = (cx: number, up: boolean) =>
		`<path d="M${cx - 5} 96 Q${cx} ${up ? 90 : 100} ${cx + 5} 96" stroke="#2b2b2b" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
	switch (expression) {
		case 'wink':
			return closed(85, false) + open(115);
		case 'laugh':
			return closed(85, true) + closed(115, true);
		case 'surprised':
			return open(85, 4.6, 5.6) + open(115, 4.6, 5.6);
		default:
			return open(85) + open(115);
	}
}

function mouth(expression: AvatarExpression): string {
	const lips = '#a8433f';
	switch (expression) {
		case 'grin':
		case 'laugh':
			return (
				`<path d="M87 117 Q100 136 113 117 Z" fill="${lips}"/>` +
				`<path d="M88.5 118 L111.5 118 Q110.5 122.5 100 122.5 Q89.5 122.5 88.5 118 Z" fill="#ffffff"/>`
			);
		case 'tongue':
			return (
				`<path d="M88 118 Q100 130 112 118 Z" fill="${lips}"/>` +
				`<path d="M94 121 Q94 135 100.5 135 Q107 135 107 121 Z" fill="#ff7a8a"/>` +
				`<path d="M100.5 124 L100.5 131" stroke="#e05a6c" stroke-width="1.2" stroke-linecap="round"/>`
			);
		case 'surprised':
			return `<ellipse cx="100" cy="123" rx="4.5" ry="5.5" fill="${lips}"/>`;
		case 'wink':
			return `<path d="M89 121 Q101 129 111 118" stroke="${lips}" stroke-width="2.8" stroke-linecap="round" fill="none"/>`;
		case 'smile':
		default:
			return `<path d="M89.5 120 Q100 130 110.5 120 Q100 124 89.5 120 Z" fill="${lips}"/>`;
	}
}

/** Hair over the head: the shape of each style, seen from the front. */
function frontHair({ hair, hairColor, headwear }: AvatarOptions): string {
	const fill = `fill="${hairColor}"`;
	// Under a hat only the hair below its brim shows: the tall quiff and bun tops are left out.
	const hatted = headwear === 'beanie' || headwear === 'cap';
	switch (hair) {
		case 'short':
			return `<path d="M60 94 C57 60 77 44 100 44 C123 44 143 60 140 94 C137 80 131 71 122 66 C108 72 88 72 76 67 C68 73 62 82 60 94 Z" ${fill}/>`;
		case 'quiff':
			return [
				`<path d="M60 94 C56 60 76 42 102 40 C124 38 144 56 140 94 C137 80 131 71 123 66 C110 71 92 71 79 66 C69 72 62 82 60 94 Z" ${fill}/>`,
				hatted ? '' : `<path d="M76 58 C82 32 116 22 132 40 C118 36 104 40 96 54 Z" ${fill}/>`
			].join('');
		case 'side':
			return `<path d="M60 96 C55 60 76 42 102 42 C127 42 145 59 140 96 C138 82 134 73 127 68 C116 62 97 58 88 66 C80 73 69 76 62 80 C61 85 60 90 60 96 Z" ${fill}/>`;
		case 'curly': {
			const curls = [
				[63, 84],
				[66, 70],
				[75, 58],
				[88, 50],
				[102, 47],
				[116, 50],
				[128, 57],
				[136, 69],
				[138, 84],
				[82, 64],
				[100, 60],
				[118, 63]
			]
				// Under a hat only the curls at the sides show.
				.filter(([, cy]) => !hatted || cy >= 68)
				.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="12" ${fill}/>`)
				.join('');
			return `<path d="M58 88 C58 60 78 44 100 44 C122 44 142 60 142 88 C130 74 116 70 100 70 C84 70 70 74 58 88 Z" ${fill}/>${curls}`;
		}
		case 'long':
			return `<path d="M59 104 C54 60 78 42 100 42 C124 42 146 60 141 104 C136 84 126 70 112 64 C102 74 82 80 64 84 C62 90 60 96 59 104 Z" ${fill}/>`;
		case 'bun':
			return `<path d="M61 92 C60 60 80 47 100 47 C120 47 140 60 139 92 C133 76 119 66 100 66 C81 66 67 76 61 92 Z" ${fill}/>`;
		case 'none':
		default:
			return '';
	}
}

function facialHair({ facialHair: style, hairColor }: AvatarOptions): string {
	const beard = `<path d="M62 96 C62 122 77 144 100 144 C123 144 138 122 138 96 C134 111 127 118 119 116 C110 112 90 112 81 116 C73 118 66 111 62 96 Z" fill="${hairColor}"`;
	const mustache = `<path d="M85 115 C91 109 98 111 100 113 C102 111 109 109 115 115 C109 118 104 117 100 116 C96 117 91 118 85 115 Z" fill="${hairColor}"/>`;
	switch (style) {
		case 'beard':
			return `${beard}/>${mustache}`;
		case 'stubble':
			return `${beard} opacity="0.28"/>`;
		case 'mustache':
			return mustache;
		case 'handlebar':
			return `<path d="M100 113 C104 109 112 109 116 114 C119 117 124 116 125 111 C127 117 123 122 116 120 C110 118 104 117 100 117 C96 117 90 118 84 120 C77 122 73 117 75 111 C76 116 81 117 84 114 C88 109 96 109 100 113 Z" fill="${hairColor}"/>`;
		case 'none':
		default:
			return '';
	}
}

function glasses({ glasses: style }: AvatarOptions): string {
	const frame = 'stroke="#1f1f1f" stroke-width="2.6" fill="#ffffff" fill-opacity="0.18"';
	const bridgeAndArms =
		`<path d="M96 93 Q100 90 104 93" stroke="#1f1f1f" stroke-width="2.4" fill="none"/>` +
		`<path d="M74 92 L63 89 M126 92 L137 89" stroke="#1f1f1f" stroke-width="2.4" stroke-linecap="round"/>`;
	switch (style) {
		case 'round':
			return `<circle cx="85" cy="95" r="11" ${frame}/><circle cx="115" cy="95" r="11" ${frame}/>${bridgeAndArms}`;
		case 'square':
			return `<rect x="72" y="85" width="25" height="19" rx="4" ${frame}/><rect x="103" y="85" width="25" height="19" rx="4" ${frame}/>${bridgeAndArms}`;
		case 'shades':
			return [
				`<path d="M71 87 L97 87 L95 99 Q93 105 85 105 Q76 105 73 99 Z" fill="#141414" stroke="#141414" stroke-width="2" stroke-linejoin="round"/>`,
				`<path d="M103 87 L129 87 L127 99 Q124 105 115 105 Q107 105 105 99 Z" fill="#141414" stroke="#141414" stroke-width="2" stroke-linejoin="round"/>`,
				`<path d="M77 91 L83 91 M109 91 L115 91" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round"/>`,
				`<path d="M96 88 L104 88" stroke="#141414" stroke-width="3"/>`,
				`<path d="M71 88 L63 89 M129 88 L137 89" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>`
			].join('');
		case 'none':
		default:
			return '';
	}
}

function headwear({ headwear: style, clothesColor }: AvatarOptions): string {
	switch (style) {
		case 'headphones':
			return [
				`<path d="M58 100 C54 46 146 46 142 100" stroke="#2b2b2b" stroke-width="6" fill="none" stroke-linecap="round"/>`,
				`<rect x="49" y="86" width="15" height="27" rx="6" fill="#2b2b2b"/>`,
				`<rect x="136" y="86" width="15" height="27" rx="6" fill="#2b2b2b"/>`,
				`<rect x="53" y="91" width="7" height="17" rx="3" fill="${clothesColor}"/>`,
				`<rect x="140" y="91" width="7" height="17" rx="3" fill="${clothesColor}"/>`
			].join('');
		case 'beanie': {
			const knit = shade(clothesColor, 0.15);
			return [
				`<path d="M58 84 C56 50 78 36 100 36 C122 36 144 50 142 84 Z" fill="${knit}"/>`,
				`<path d="M80 42 L80 80 M100 38 L100 80 M120 42 L120 80" stroke="${shade(clothesColor, -0.05)}" stroke-width="2" opacity="0.5"/>`,
				`<path d="M56 78 C80 70 120 70 144 78 L144 90 C120 82 80 82 56 90 Z" fill="${shade(clothesColor, -0.15)}"/>`,
				`<circle cx="100" cy="32" r="8" fill="${shade(clothesColor, 0.45)}"/>`
			].join('');
		}
		case 'cap':
			return [
				`<path d="M60 80 C60 50 80 40 100 40 C120 40 140 50 140 80 Z" fill="${clothesColor}"/>`,
				`<path d="M100 40 L100 80" stroke="${shade(clothesColor, -0.2)}" stroke-width="1.5"/>`,
				`<path d="M60 78 C82 70 130 70 154 82 C132 88 82 88 60 81 Z" fill="${shade(clothesColor, -0.22)}"/>`,
				`<circle cx="100" cy="41" r="3" fill="${shade(clothesColor, -0.22)}"/>`
			].join('');
		case 'party':
			return [
				`<path d="M80 56 L106 8 L124 52 Q102 60 80 56 Z" fill="#e9b949"/>`,
				`<path d="M86 45 Q102 49 119 42 M94 30 Q104 33 114 28 M100 19 Q105 20 109 17" stroke="#e76f51" stroke-width="4" fill="none" stroke-linecap="round"/>`,
				`<circle cx="106" cy="8" r="6.5" fill="#3a86ff"/>`
			].join('');
		case 'crown':
			return [
				`<path d="M70 58 L74 28 L88 44 L100 22 L112 44 L126 28 L130 58 Q100 64 70 58 Z" fill="#f4c430" stroke="#d4a017" stroke-width="2" stroke-linejoin="round"/>`,
				`<circle cx="100" cy="50" r="4" fill="#e74c3c"/>`,
				`<circle cx="83" cy="52" r="3" fill="#3a86ff"/>`,
				`<circle cx="117" cy="52" r="3" fill="#2a9d8f"/>`,
				`<circle cx="74" cy="27" r="2.6" fill="#f4c430"/><circle cx="100" cy="21" r="2.6" fill="#f4c430"/><circle cx="126" cy="27" r="2.6" fill="#f4c430"/>`
			].join('');
		case 'none':
		default:
			return '';
	}
}
