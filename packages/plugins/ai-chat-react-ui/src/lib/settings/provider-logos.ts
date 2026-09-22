// cspell:ignore googlegemini potrace wordmark

/*
 * Bundled brand marks for the AI provider tiles.
 *
 * The path data is inlined rather than installed as a runtime dependency or
 * hot-linked from a CDN, because this page has to draw correctly offline and
 * under the app's strict CSP; inlining also means the plugin needs no asset
 * glob in the host application's build.
 *
 * Sources
 * -------
 * - `openai`, `anthropic`, `vercel`, `googlegemini`, `openrouter` and `x` come
 *   from simple-icons (https://github.com/simple-icons/simple-icons), which
 *   dedicates its icons to the public domain under CC0 1.0 Universal
 *   (https://creativecommons.org/publicdomain/zero/1.0/). Taken from v16.27.1,
 *   except OpenAI: that icon was dropped in v16, so it comes from v15.0.0.
 *   simple-icons ships no `xai`/`grok` slug, so Grok (xAI) reuses the `x` mark.
 * - `gauzy-ai` is this repository's own logo — the very artwork the Integrations
 *   page renders (apps/api/src/assets/seed/integrations/gauzy-ai.svg). It is
 *   copied here instead of referenced, because that file is served by the API
 *   and a settings tile must not depend on an API asset URL to draw.
 *
 * These marks are trademarks of their owners and are used only to identify the
 * provider a tenant is connecting to.
 */

/** A brand mark bundled with the plugin, rendered as an inline `<svg>`. */
export interface IProviderLogo {
	/** `viewBox` of the source artwork. */
	readonly viewBox: string;
	/** The `d` attribute of every path making up the mark. */
	readonly paths: readonly string[];
	/**
	 * Fixed brand colour, for marks whose identity *is* the colour.
	 *
	 * Omitted for monochrome marks: those inherit `currentColor` from a theme
	 * token, which is what makes them flip from dark-on-light to light-on-dark
	 * instead of disappearing into the dark themes.
	 */
	readonly brandColor?: string;
	/** Transform for the path group, when the source artwork needs one. */
	readonly transform?: string;
}

/**
 * Brand marks keyed by provider id.
 *
 * A provider with no entry here (e.g. one contributed by a future plugin)
 * falls back to the monogram tile, so a tile is never an empty box.
 */
export const PROVIDER_LOGOS: Readonly<Record<string, IProviderLogo>> = {
	// Gauzy AI — repository artwork. The trace is stored in tenth-of-a-unit,
	// y-flipped coordinates (potrace output), hence the group transform; the
	// viewBox is cropped to the ink so the wordmark fills the tile rather than
	// floating in the empty half of the original 200×200 canvas.
	'gauzy-ai': {
		viewBox: '26 61 153 88',
		transform: 'translate(0,200) scale(0.1,-0.1)',
		paths: [
			'M444 1342 c-73 -35 -115 -125 -94 -203 23 -83 94 -114 196 -84 56 16 56 17 50 48 -8 42 -19 51 -44 38 -34 -18 -90 -14 -101 8 -6 10 -7 21 -4 25 3 3 43 6 89 6 93 0 94 1 94 79 0 38 -5 52 -25 71 -34 32 -106 37 -161 12z m104 -84 c3 -15 -4 -18 -42 -18 -25 0 -46 4 -46 8 0 34 82 42 88 10z',
			'M709 1353 c-9 -2 -19 -18 -23 -35 -9 -47 -7 -56 12 -54 12 1 16 -6 15 -24 -11 -118 -8 -141 20 -166 39 -33 129 -34 177 -1 63 42 74 67 78 177 l4 100 -55 0 -56 0 6 -70 c6 -77 -7 -125 -37 -133 -35 -9 -44 17 -32 88 6 35 8 73 5 83 -8 32 -63 49 -114 35z',
			'M1138 1340 c-69 -37 -106 -114 -92 -193 14 -86 94 -123 199 -93 60 18 60 18 44 65 -9 24 -15 30 -28 25 -54 -24 -121 -12 -121 22 0 11 20 14 89 14 84 0 89 1 95 23 9 34 7 86 -4 108 -26 48 -117 63 -182 29z m110 -82 c3 -15 -4 -18 -42 -18 -25 0 -46 4 -46 8 0 34 82 42 88 10z',
			'M1413 1350 c-19 -8 -23 -17 -23 -50 0 -29 4 -40 15 -40 19 0 19 -14 0 -120 -8 -47 -15 -86 -15 -87 0 -2 22 -3 49 -3 56 0 54 -3 71 104 15 88 33 110 86 100 30 -5 31 -4 44 41 11 40 11 48 -1 56 -23 14 -55 10 -80 -10 -23 -19 -24 -19 -48 0 -25 20 -62 23 -98 9z',
			'M1740 1141 c7 -13 10 -34 7 -47 -2 -13 0 -21 4 -18 14 8 10 49 -7 70 -14 18 -15 18 -4 -5z',
			'M1678 1103 c7 -3 16 -2 19 1 4 3 -2 6 -13 5 -11 0 -14 -3 -6 -6z',
			'M1715 1050 c-3 -6 1 -7 9 -4 18 7 21 14 7 14 -6 0 -13 -4 -16 -10z',
			'M1521 883 c-46 -92 -112 -246 -108 -257 2 -6 14 8 26 32 l21 42 64 0 63 0 7 -40 c3 -22 11 -40 17 -40 6 0 9 10 6 23 -3 12 -16 79 -28 150 -25 138 -36 152 -68 90z m43 -54 c4 -29 10 -65 13 -80 l6 -29 -58 0 c-42 0 -56 3 -52 13 26 67 71 156 77 152 4 -2 10 -28 14 -56z',
			'M1706 908 c-6 -19 -36 -250 -36 -273 0 -11 3 -15 9 -10 5 6 16 66 25 135 9 69 19 133 21 143 4 19 -14 24 -19 5z',
			'M361 823 c-85 -86 -44 -236 52 -188 17 8 32 13 35 10 3 -2 -2 -21 -9 -42 -18 -46 -55 -63 -100 -46 -23 9 -29 9 -26 0 6 -19 59 -30 89 -18 15 5 34 21 43 34 16 25 53 253 42 263 -3 4 -26 9 -51 11 -40 5 -48 2 -75 -24z m101 -62 c-3 -71 -22 -108 -60 -118 -38 -9 -57 8 -60 57 -7 88 24 133 86 128 l37 -3 -3 -64z',
			'M599 835 c-59 -32 -79 -146 -34 -190 29 -29 36 -30 78 -9 21 12 32 13 35 5 2 -6 11 -11 19 -11 12 0 13 3 5 13 -8 9 -7 38 2 100 12 82 12 89 -5 97 -25 14 -70 12 -100 -5z m93 -10 c2 -3 0 -35 -5 -72 -12 -96 -62 -139 -109 -96 -30 27 -20 112 19 155 15 17 82 26 95 13z',
			'M780 753 c-13 -96 -13 -97 10 -115 26 -21 53 -17 88 15 l22 20 0 -28 c0 -57 17 -8 28 81 14 110 15 124 3 124 -5 0 -12 -32 -16 -71 -6 -59 -12 -77 -37 -105 -32 -37 -58 -43 -78 -19 -12 15 -11 43 7 158 3 22 1 37 -4 37 -6 0 -16 -44 -23 -97z',
			'M1000 840 c0 -5 24 -10 54 -12 l54 -3 -74 -94 c-41 -51 -71 -97 -68 -102 7 -12 131 -11 139 1 4 6 -15 10 -49 10 -31 0 -56 4 -56 9 0 5 32 49 70 99 39 50 70 93 70 96 0 3 -31 6 -70 6 -38 0 -70 -4 -70 -10z',
			'M1155 828 c3 -13 14 -68 26 -123 l20 -100 -37 -32 c-21 -18 -34 -33 -30 -33 15 0 52 24 66 44 26 36 129 266 119 266 -9 0 -62 -107 -91 -180 -13 -34 -22 -15 -37 75 -7 39 -14 78 -17 88 -8 25 -25 21 -19 -5z'
		]
	},

	// OpenRouter. simple-icons records the brand hex as #94A3B8 (slate), but a
	// mid-grey mark clears neither the light nor the dark tile at the 3:1 WCAG
	// non-text minimum, and OpenRouter itself draws the mark in the surrounding
	// text colour — so it is treated as monochrome and inherits the theme.
	openrouter: {
		viewBox: '0 0 24 24',
		paths: [
			'M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z'
		]
	},

	// Vercel AI Gateway — the Vercel triangle, monochrome by design.
	'vercel-gateway': {
		viewBox: '0 0 24 24',
		paths: ['m12 1.608 12 20.784H0Z']
	},

	// Anthropic — monochrome by design (brand hex #191919).
	anthropic: {
		viewBox: '0 0 24 24',
		paths: [
			'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z'
		]
	},

	// OpenAI — monochrome by design.
	openai: {
		viewBox: '0 0 24 24',
		paths: [
			'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'
		]
	},

	// Google Gemini — the one mark here whose identity is its colour, so it keeps
	// the simple-icons brand hex instead of inheriting the theme. #8E75B2 clears
	// 3:1 against the neutral tile in both the light and the dark themes.
	gemini: {
		viewBox: '0 0 24 24',
		brandColor: '#8E75B2',
		paths: [
			'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81'
		]
	},

	// Grok (xAI) — the X mark, monochrome by design.
	grok: {
		viewBox: '0 0 24 24',
		paths: [
			'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z'
		]
	}
};
