import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';
import { AssistantRobot } from './AssistantRobot';

export interface ChatWelcomeProps {
	/** `t(key, fallback)` from the panel — see `useChatTranslate`. */
	translate?: ChatTranslate;
}

/** The AI accent: the chat's blue into the user bubble's violet. */
const AI_FROM = '#3366ff';
const AI_TO = '#8b5cf6';

/**
 * One round of the demo, as line widths (px) — no words, just the shape of a conversation. Rounds
 * differ so the loop does not read as one clip replaying.
 */
interface DemoRound {
	question: number[];
	answer: number[];
}

const ROUNDS: DemoRound[] = [
	{ question: [62], answer: [118, 96, 54] },
	{ question: [84, 40], answer: [104, 70] },
	{ question: [48], answer: [122, 110, 88, 38] }
];

/** Where a round is. `out` fades the round away before the next one starts. */
type DemoPhase = 'ask' | 'typing' | 'answer' | 'hold' | 'out';

/** How long each phase lasts (ms). `answer` is derived from the number of lines. */
const PHASE_MS = { ask: 650, typing: 1100, hold: 2200, out: 400 } as const;
/** One answer line "writes" itself in this long; the next starts as it finishes. */
const LINE_MS = 320;

const welcomeCss = `
	@keyframes gzWelcomeFade { from { opacity: 0; } to { opacity: 1; } }
	@keyframes gzWelcomeBubbleIn {
		from { opacity: 0; transform: translateY(5px) scale(0.97); }
		to { opacity: 1; transform: none; }
	}
	@keyframes gzWelcomeDot {
		0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
		40% { transform: translateY(-2px); opacity: 1; }
	}
	@keyframes gzWelcomeLine { from { transform: scaleX(0); } to { transform: none; } }
	.gz-ai-welcome-robot { animation: gzWelcomeFade 0.6s ease both; }
	.gz-ai-welcome-copy { animation: gzWelcomeFade 0.6s ease 0.2s both; }
	.gz-ai-welcome-bubble {
		transform-origin: bottom center;
		animation: gzWelcomeBubbleIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	.gz-ai-welcome-dot { animation: gzWelcomeDot 1.1s ease-in-out infinite; }
	.gz-ai-welcome-line {
		transform-origin: left center;
		animation: gzWelcomeLine ${LINE_MS}ms ease-out both;
	}
	.gz-ai-welcome-round { transition: opacity 0.4s ease, transform 0.4s ease; }
	/* Off screen (chat collapsed, tab in the background): freeze, so nothing animates unseen. */
	.gz-ai-welcome-paused .gz-ai-welcome-dot,
	.gz-ai-welcome-paused .gz-ai-welcome-line,
	.gz-ai-welcome-paused .gz-ai-welcome-bubble { animation-play-state: paused; }
	@media (prefers-reduced-motion: reduce) {
		.gz-ai-welcome-robot,
		.gz-ai-welcome-copy,
		.gz-ai-welcome-bubble,
		.gz-ai-welcome-dot,
		.gz-ai-welcome-line { animation: none; }
		.gz-ai-welcome-round { transition: none; }
	}
`;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Does the user ask the OS for less motion? Live: the setting can change while the welcome is
 * open, and the demo's JavaScript timeline must stop then too — the CSS media query alone only
 * stops the CSS animations.
 */
function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(
		() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_MOTION_QUERY).matches
	);
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const query = window.matchMedia(REDUCED_MOTION_QUERY);
		const onChange = () => setReduced(query.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	}, []);
	return reduced;
}

/**
 * Is the element on screen? False while the chat is collapsed (`display: none` intersects nothing)
 * or the tab is in the background — the demo then holds still instead of ticking unseen.
 */
function useIsVisible(ref: { current: HTMLElement | null }): boolean {
	const [inView, setInView] = useState(true);
	const [pageVisible, setPageVisible] = useState(
		() => typeof document === 'undefined' || document.visibilityState !== 'hidden'
	);

	useEffect(() => {
		const element = ref.current;
		if (!element || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver((entries) => setInView(entries.some((entry) => entry.isIntersecting)));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	useEffect(() => {
		if (typeof document === 'undefined') return;
		const onChange = () => setPageVisible(document.visibilityState !== 'hidden');
		document.addEventListener('visibilitychange', onChange);
		return () => document.removeEventListener('visibilitychange', onChange);
	}, []);

	return inView && pageVisible;
}

/** The assistant's avatar in the demo: the robot glyph (as in the panel header) on the AI accent. */
function AssistantAvatar() {
	return (
		<span
			style={{
				width: 16,
				height: 16,
				flexShrink: 0,
				borderRadius: '50%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: `linear-gradient(135deg, ${AI_FROM}, ${AI_TO})`,
				color: '#ffffff'
			}}
		>
			<svg
				width="10"
				height="10"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.4"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 8V4H8" />
				<rect width="16" height="12" x="4" y="8" rx="2" />
				<path d="M15 13v2" />
				<path d="M9 13v2" />
			</svg>
		</span>
	);
}

/** A skeleton text line. `animated` makes it write itself in, `delay` ms after its bubble appears. */
function Line({ width, color, delay, animated }: { width: number; color: string; delay?: number; animated?: boolean }) {
	return (
		<span
			className={animated ? 'gz-ai-welcome-line' : undefined}
			style={{
				display: 'block',
				width,
				maxWidth: '100%',
				height: 5,
				borderRadius: 3,
				backgroundColor: color,
				...(animated && delay ? { animationDelay: `${delay}ms` } : {})
			}}
		/>
	);
}

/**
 * ChatWelcome
 *
 * Empty-state view of a new conversation: the animated assistant robot, then a small looping sketch of a
 * conversation — no words, only its shape. A question bubble pops in on the user's side, the
 * assistant shows typing dots, then its reply bubble writes itself line by line before the round
 * fades and the next begins. It uses the chat's own bubble colours and corners, so it previews what
 * the panel does. Decorative (hidden from screen readers; the title and hint carry the meaning), and
 * with reduced motion one finished exchange is shown still.
 */
export function ChatWelcome({ translate: t = passthroughChatTranslate }: ChatWelcomeProps) {
	const reducedMotion = usePrefersReducedMotion();
	const [round, setRound] = useState(0);
	const [phase, setPhase] = useState<DemoPhase>(reducedMotion ? 'hold' : 'ask');
	const rootRef = useRef<HTMLDivElement>(null);
	const visible = useIsVisible(rootRef);

	const demo = ROUNDS[round % ROUNDS.length];

	// Turned on mid-round: settle on the finished exchange of the current round and stay there.
	// Turned off again: the timeline below simply resumes from it.
	useEffect(() => {
		if (reducedMotion) setPhase('hold');
	}, [reducedMotion]);

	// The round's timeline: one timer at a time, and none at all while the welcome is not on screen
	// or the user prefers reduced motion (which stops at one finished exchange).
	useEffect(() => {
		if (reducedMotion || !visible) return;
		const next: Record<DemoPhase, [DemoPhase, number]> = {
			ask: ['typing', PHASE_MS.ask],
			typing: ['answer', PHASE_MS.typing],
			answer: ['hold', demo.answer.length * LINE_MS],
			hold: ['out', PHASE_MS.hold],
			out: ['ask', PHASE_MS.out]
		};
		const [following, wait] = next[phase];
		const timer = setTimeout(() => {
			if (phase === 'out') setRound((value) => value + 1);
			setPhase(following);
		}, wait);
		return () => clearTimeout(timer);
	}, [phase, demo.answer.length, reducedMotion, visible]);

	const showAnswer = phase === 'answer' || phase === 'hold' || phase === 'out';

	const containerStyle: CSSProperties = {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '24px 18px',
		textAlign: 'center',
		gap: 16
	};

	const userBubbleStyle: CSSProperties = {
		alignSelf: 'flex-end',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'flex-end',
		gap: 5,
		padding: '8px 10px',
		borderRadius: `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadiusTight} ${chatTheme.bubbleRadius}`,
		backgroundColor: chatTheme.userBubbleBg
	};

	const assistantBubbleStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: 5,
		padding: '8px 10px',
		borderRadius: `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadiusTight}`,
		backgroundColor: chatTheme.assistantBubbleBg,
		border: `1px solid ${chatTheme.borderSoft}`
	};

	const dotStyle: CSSProperties = {
		width: 4,
		height: 4,
		borderRadius: '50%',
		backgroundColor: chatTheme.textSecondary,
		display: 'inline-block'
	};

	/** Line tones: light on the violet user bubble, a quiet text tint on the assistant's. */
	const userLine = 'rgba(255, 255, 255, 0.6)';
	const assistantLine = 'color-mix(in srgb, currentColor 26%, transparent)';

	return (
		<div ref={rootRef} style={containerStyle} className={visible ? undefined : 'gz-ai-welcome-paused'}>
			<style>{welcomeCss}</style>

			<div className="gz-ai-welcome-robot">
				<AssistantRobot size={92} talking={!reducedMotion && (phase === 'typing' || phase === 'answer')} />
			</div>

			{/* The demo. Fixed at the height of its LONGEST round (a two-line question over a four-line
			    reply), so the title below never moves — and no taller, so it does not float apart
			    from the text under it. */}
			<div
				aria-hidden="true"
				className="gz-ai-welcome-round"
				style={{
					width: 200,
					maxWidth: '100%',
					height: 92,
					display: 'flex',
					flexDirection: 'column',
					gap: 7,
					color: chatTheme.textPrimary,
					opacity: phase === 'out' ? 0 : 1,
					transform: phase === 'out' ? 'translateY(-4px)' : 'none'
				}}
			>
				<div key={`q-${round}`} className="gz-ai-welcome-bubble" style={userBubbleStyle}>
					{demo.question.map((width, index) => (
						<Line key={index} width={width} color={userLine} />
					))}
				</div>

				{phase !== 'ask' && (
					<div
						key={`a-${round}`}
						className="gz-ai-welcome-bubble"
						style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}
					>
						<AssistantAvatar />
						{showAnswer ? (
							<div style={assistantBubbleStyle}>
								{demo.answer.map((width, index) => (
									<Line
										key={index}
										width={width}
										color={assistantLine}
										animated={!reducedMotion}
										delay={index * LINE_MS}
									/>
								))}
							</div>
						) : (
							<div style={{ ...assistantBubbleStyle, flexDirection: 'row', alignItems: 'center', gap: 3, padding: '9px 10px' }}>
								<span className="gz-ai-welcome-dot" style={dotStyle} />
								<span className="gz-ai-welcome-dot" style={{ ...dotStyle, animationDelay: '0.15s' }} />
								<span className="gz-ai-welcome-dot" style={{ ...dotStyle, animationDelay: '0.3s' }} />
							</div>
						)}
					</div>
				)}
			</div>

			<div
				className="gz-ai-welcome-copy"
				style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}
			>
				<h3
					style={{
						fontSize: chatTheme.fontSizeLarge,
						fontWeight: chatTheme.fontWeightSemibold,
						letterSpacing: '-0.005em',
						color: chatTheme.textPrimary,
						margin: 0
					}}
				>
					{t('AI_ASSISTANT.TITLE', 'AI Assistant')}
				</h3>
				<p
					style={{
						fontSize: chatTheme.fontSizeSmall,
						color: chatTheme.textSecondary,
						margin: 0,
						maxWidth: 240,
						lineHeight: 1.6,
						// Even line lengths instead of one word left alone on the last line.
						textWrap: 'balance'
					}}
				>
					{t('AI_ASSISTANT.WELCOME_SUBTITLE', 'Ask anything about your workspace, tasks, or projects.')}
				</p>
			</div>
		</div>
	);
}
