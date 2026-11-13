/** One emoji the composer offers for a `:shortcode`, with the other names it is found by. */
export interface ChatEmoji {
	code: string;
	emoji: string;
	aliases?: readonly string[];
}

/**
 * The emoji the `:` autocomplete offers: the ones people reach for in a work chat, by plain English names. Typing
 * `:` and two letters lists the matches; a complete `:name:` is replaced as it is typed. The message stores the
 * emoji itself (Unicode), so every client shows it, with or without this table.
 */
export const CHAT_EMOJI: readonly ChatEmoji[] = [
	{ code: 'smile', emoji: '😄', aliases: ['happy'] },
	{ code: 'grin', emoji: '😁' },
	{ code: 'joy', emoji: '😂', aliases: ['laughing', 'lol'] },
	{ code: 'rofl', emoji: '🤣' },
	{ code: 'slightly_smiling', emoji: '🙂' },
	{ code: 'upside_down', emoji: '🙃' },
	{ code: 'wink', emoji: '😉' },
	{ code: 'blush', emoji: '😊' },
	{ code: 'heart_eyes', emoji: '😍', aliases: ['love'] },
	{ code: 'star_struck', emoji: '🤩' },
	{ code: 'kiss', emoji: '😘' },
	{ code: 'yum', emoji: '😋' },
	{ code: 'stuck_out_tongue', emoji: '😛', aliases: ['tongue'] },
	{ code: 'zany', emoji: '🤪' },
	{ code: 'hugging', emoji: '🤗', aliases: ['hug'] },
	{ code: 'thinking', emoji: '🤔', aliases: ['hmm'] },
	{ code: 'shushing', emoji: '🤫' },
	{ code: 'neutral', emoji: '😐' },
	{ code: 'expressionless', emoji: '😑' },
	{ code: 'no_mouth', emoji: '😶' },
	{ code: 'smirk', emoji: '😏' },
	{ code: 'unamused', emoji: '😒' },
	{ code: 'roll_eyes', emoji: '🙄' },
	{ code: 'grimacing', emoji: '😬' },
	{ code: 'relieved', emoji: '😌' },
	{ code: 'pensive', emoji: '😔' },
	{ code: 'sleepy', emoji: '😪' },
	{ code: 'sleeping', emoji: '😴' },
	{ code: 'mask', emoji: '😷' },
	{ code: 'nerd', emoji: '🤓' },
	{ code: 'sunglasses', emoji: '😎', aliases: ['cool'] },
	{ code: 'confused', emoji: '😕' },
	{ code: 'worried', emoji: '😟' },
	{ code: 'frowning', emoji: '🙁' },
	{ code: 'open_mouth', emoji: '😮', aliases: ['wow'] },
	{ code: 'astonished', emoji: '😲' },
	{ code: 'flushed', emoji: '😳' },
	{ code: 'pleading', emoji: '🥺' },
	{ code: 'cry', emoji: '😢', aliases: ['sad'] },
	{ code: 'sob', emoji: '😭' },
	{ code: 'scream', emoji: '😱' },
	{ code: 'sweat_smile', emoji: '😅' },
	{ code: 'sweat', emoji: '😓' },
	{ code: 'tired', emoji: '😫' },
	{ code: 'yawning', emoji: '🥱' },
	{ code: 'angry', emoji: '😠' },
	{ code: 'rage', emoji: '😡' },
	{ code: 'exploding_head', emoji: '🤯', aliases: ['mind_blown'] },
	{ code: 'partying', emoji: '🥳' },
	{ code: 'innocent', emoji: '😇', aliases: ['halo'] },
	{ code: 'skull', emoji: '💀' },
	{ code: 'ghost', emoji: '👻' },
	{ code: 'robot', emoji: '🤖', aliases: ['bot'] },
	{ code: 'clown', emoji: '🤡' },
	{ code: 'thumbs_up', emoji: '👍', aliases: ['like', 'yes', 'plus_one', '+1'] },
	{ code: 'thumbs_down', emoji: '👎', aliases: ['dislike', 'no', 'minus_one', '-1'] },
	{ code: 'ok_hand', emoji: '👌', aliases: ['ok'] },
	{ code: 'clap', emoji: '👏', aliases: ['applause'] },
	{ code: 'raised_hands', emoji: '🙌', aliases: ['hooray'] },
	{ code: 'wave', emoji: '👋', aliases: ['hello', 'bye'] },
	{ code: 'pray', emoji: '🙏', aliases: ['thanks', 'please'] },
	{ code: 'handshake', emoji: '🤝', aliases: ['deal'] },
	{ code: 'muscle', emoji: '💪', aliases: ['strong'] },
	{ code: 'point_up', emoji: '☝️' },
	{ code: 'point_right', emoji: '👉' },
	{ code: 'point_left', emoji: '👈' },
	{ code: 'point_down', emoji: '👇' },
	{ code: 'crossed_fingers', emoji: '🤞', aliases: ['luck'] },
	{ code: 'victory', emoji: '✌️', aliases: ['peace'] },
	{ code: 'raised_hand', emoji: '✋', aliases: ['stop'] },
	{ code: 'writing_hand', emoji: '✍️' },
	{ code: 'eyes', emoji: '👀', aliases: ['looking'] },
	{ code: 'brain', emoji: '🧠' },
	{ code: 'heart', emoji: '❤️' },
	{ code: 'orange_heart', emoji: '🧡' },
	{ code: 'yellow_heart', emoji: '💛' },
	{ code: 'green_heart', emoji: '💚' },
	{ code: 'blue_heart', emoji: '💙' },
	{ code: 'purple_heart', emoji: '💜' },
	{ code: 'broken_heart', emoji: '💔' },
	{ code: 'sparkling_heart', emoji: '💖' },
	{ code: 'fire', emoji: '🔥', aliases: ['lit'] },
	{ code: 'sparkles', emoji: '✨' },
	{ code: 'star', emoji: '⭐' },
	{ code: 'boom', emoji: '💥' },
	{ code: 'zap', emoji: '⚡', aliases: ['lightning'] },
	{ code: 'party', emoji: '🎉', aliases: ['celebrate', 'congrats'] },
	{ code: 'confetti', emoji: '🎊' },
	{ code: 'balloon', emoji: '🎈' },
	{ code: 'gift', emoji: '🎁' },
	{ code: 'trophy', emoji: '🏆', aliases: ['win'] },
	{ code: 'medal', emoji: '🏅' },
	{ code: 'rocket', emoji: '🚀', aliases: ['ship', 'launch'] },
	{ code: 'hundred', emoji: '💯', aliases: ['100'] },
	{ code: 'check', emoji: '✅', aliases: ['done', 'white_check_mark'] },
	{ code: 'check_mark', emoji: '✔️' },
	{ code: 'x', emoji: '❌', aliases: ['cross'] },
	{ code: 'warning', emoji: '⚠️' },
	{ code: 'no_entry', emoji: '⛔' },
	{ code: 'question', emoji: '❓' },
	{ code: 'exclamation', emoji: '❗' },
	{ code: 'bulb', emoji: '💡', aliases: ['idea'] },
	{ code: 'memo', emoji: '📝', aliases: ['note'] },
	{ code: 'pushpin', emoji: '📌', aliases: ['pin'] },
	{ code: 'paperclip', emoji: '📎' },
	{ code: 'link', emoji: '🔗' },
	{ code: 'lock', emoji: '🔒' },
	{ code: 'key', emoji: '🔑' },
	{ code: 'bell', emoji: '🔔' },
	{ code: 'mega', emoji: '📣', aliases: ['announce'] },
	{ code: 'calendar', emoji: '📅' },
	{ code: 'clock', emoji: '🕒', aliases: ['time'] },
	{ code: 'hourglass', emoji: '⏳', aliases: ['wait'] },
	{ code: 'chart_up', emoji: '📈', aliases: ['growth'] },
	{ code: 'chart_down', emoji: '📉' },
	{ code: 'bar_chart', emoji: '📊' },
	{ code: 'computer', emoji: '💻', aliases: ['laptop'] },
	{ code: 'keyboard', emoji: '⌨️' },
	{ code: 'phone', emoji: '📱' },
	{ code: 'email', emoji: '📧', aliases: ['mail'] },
	{ code: 'package', emoji: '📦' },
	{ code: 'wrench', emoji: '🔧', aliases: ['fix'] },
	{ code: 'hammer', emoji: '🔨' },
	{ code: 'gear', emoji: '⚙️', aliases: ['settings'] },
	{ code: 'bug', emoji: '🐛' },
	{ code: 'construction', emoji: '🚧', aliases: ['wip'] },
	{ code: 'mag', emoji: '🔍', aliases: ['search'] },
	{ code: 'books', emoji: '📚' },
	{ code: 'money', emoji: '💰' },
	{ code: 'coffee', emoji: '☕' },
	{ code: 'tea', emoji: '🍵' },
	{ code: 'beer', emoji: '🍺' },
	{ code: 'pizza', emoji: '🍕' },
	{ code: 'cake', emoji: '🎂', aliases: ['birthday'] },
	{ code: 'sun', emoji: '☀️' },
	{ code: 'cloud', emoji: '☁️' },
	{ code: 'rain', emoji: '🌧️' },
	{ code: 'snowflake', emoji: '❄️' },
	{ code: 'rainbow', emoji: '🌈' },
	{ code: 'earth', emoji: '🌍', aliases: ['world', 'globe'] },
	{ code: 'seedling', emoji: '🌱' },
	{ code: 'dog', emoji: '🐶' },
	{ code: 'cat', emoji: '🐱' },
	{ code: 'unicorn', emoji: '🦄' },
	{ code: 'turtle', emoji: '🐢', aliases: ['slow'] },
	{ code: 'snail', emoji: '🐌' },
	{ code: 'see_no_evil', emoji: '🙈' },
	{ code: 'speech_balloon', emoji: '💬', aliases: ['comment'] },
	{ code: 'thought_balloon', emoji: '💭' },
	{ code: 'zzz', emoji: '💤' },
	{ code: 'wave_flag', emoji: '🏁', aliases: ['finish'] },
	{ code: 'red_circle', emoji: '🔴' },
	{ code: 'green_circle', emoji: '🟢' },
	{ code: 'yellow_circle', emoji: '🟡' },
	{ code: 'arrow_up', emoji: '⬆️' },
	{ code: 'arrow_down', emoji: '⬇️' },
	{ code: 'arrow_right', emoji: '➡️' },
	{ code: 'arrow_left', emoji: '⬅️' },
	{ code: 'repeat', emoji: '🔁' }
];

const BY_NAME: ReadonlyMap<string, ChatEmoji> = new Map(CHAT_EMOJI.flatMap((emoji) => [emoji.code, ...(emoji.aliases ?? [])].map((name) => [name, emoji] as const)));

/** The emoji of a name or alias, exact; undefined when none. */
export function emojiByName(name: string): ChatEmoji | undefined {
	return BY_NAME.get(name.toLowerCase());
}

/** The characters a shortcode is made of. */
const NAME = '[a-z0-9_+-]';

/**
 * The `:` query under the caret: a colon at the start or after a space or an opening bracket, then at least two
 * name characters, the caret right after them. A time (`10:30`), a URL (`https://`) or a ratio never opens it.
 */
export function emojiQueryAt(text: string, caret: number): { query: string; start: number } | null {
	const before = text.slice(0, caret);
	const match = new RegExp(`(^|[\\s(\\[])(:(${NAME}{2,}))$`, 'i').exec(before);
	if (!match) return null;
	return { query: match[3].toLowerCase(), start: caret - match[2].length };
}

/**
 * The emoji a query finds, a few at most: a name that starts with the query first (the shortest first), then one
 * that only holds it; aliases count like names, each emoji listed once.
 */
export function suggestEmoji(query: string, limit = 8): ChatEmoji[] {
	const needle = query.trim().toLowerCase();
	if (needle.length < 2) return [];
	const scored: Array<{ emoji: ChatEmoji; rank: number; length: number; index: number }> = [];
	CHAT_EMOJI.forEach((emoji, index) => {
		let best: { rank: number; length: number } | null = null;
		for (const name of [emoji.code, ...(emoji.aliases ?? [])]) {
			const rank = name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : -1;
			if (rank < 0) continue;
			if (!best || rank < best.rank || (rank === best.rank && name.length < best.length)) best = { rank, length: name.length };
		}
		if (best) scored.push({ emoji, ...best, index });
	});
	return scored
		.sort((a, b) => a.rank - b.rank || a.length - b.length || a.index - b.index)
		.slice(0, limit)
		.map((entry) => entry.emoji);
}

/**
 * A complete `:name:` of a known emoji right before the caret, replaced by the emoji: the text and the caret after
 * it; null when the text before the caret does not end with one (an unknown name is left as typed).
 */
export function replaceShortcodeBefore(text: string, caret: number): { text: string; caret: number } | null {
	const before = text.slice(0, caret);
	const match = new RegExp(`(^|[\\s(\\[])(:(${NAME}{1,}):)$`, 'i').exec(before);
	if (!match) return null;
	const emoji = emojiByName(match[3]);
	if (!emoji) return null;
	const start = caret - match[2].length;
	return { text: `${text.slice(0, start)}${emoji.emoji}${text.slice(caret)}`, caret: start + emoji.emoji.length };
}
