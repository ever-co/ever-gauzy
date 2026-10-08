import { useId } from 'react';

export interface AssistantRobotProps {
	/** Rendered size in px (the robot is square). */
	size?: number;
	/** True while the assistant is "speaking" — the mouth moves. */
	talking?: boolean;
}

/** The AI accent: the chat's blue into the user bubble's violet. */
const AI_FROM = '#3366ff';
const AI_TO = '#8b5cf6';

/**
 * Every animation moves only `transform` / `opacity` — compositor work, no layout or paint per
 * frame — and none uses an SVG filter (a blurred glow would re-rasterise every frame; the glows
 * here are plain translucent shapes). `.gz-ai-welcome-paused` on an ancestor freezes them while the
 * robot is off screen, and reduced motion turns them off.
 */
const robotCss = `
	@keyframes gzBotFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
	@keyframes gzBotTurn { from { transform: rotateY(-14deg) rotateX(4deg); } to { transform: rotateY(14deg) rotateX(-2deg); } }
	@keyframes gzBotFace { from { transform: translateX(-2.5px); } to { transform: translateX(2.5px); } }
	@keyframes gzBotShadow { 0%, 100% { transform: scaleX(1); opacity: 0.55; } 50% { transform: scaleX(0.82); opacity: 0.3; } }
	@keyframes gzBotBlink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.12); } }
	@keyframes gzBotGlance {
		0%, 30%, 100% { transform: translateX(0); }
		38%, 55% { transform: translateX(-2.5px); }
		63%, 80% { transform: translateX(2.5px); }
	}
	@keyframes gzBotPulse { 0%, 100% { opacity: 0.45; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
	@keyframes gzBotTalk { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }

	.gz-bot-stage { perspective: 320px; }
	.gz-bot-float { animation: gzBotFloat 3.6s ease-in-out infinite; }
	.gz-bot-turn { transform-style: preserve-3d; animation: gzBotTurn 7s ease-in-out infinite alternate; }
	.gz-bot-shadow { transform-box: fill-box; transform-origin: center; animation: gzBotShadow 3.6s ease-in-out infinite; }
	.gz-bot-face { animation: gzBotFace 7s ease-in-out infinite alternate; }
	.gz-bot-glance { animation: gzBotGlance 6s ease-in-out infinite; }
	.gz-bot-eye { transform-box: fill-box; transform-origin: center; animation: gzBotBlink 4.5s ease-in-out infinite; }
	.gz-bot-tip { transform-box: fill-box; transform-origin: center; animation: gzBotPulse 2.4s ease-in-out infinite; }
	.gz-bot-mouth-bar { transform-box: fill-box; transform-origin: center; transform: scaleY(0.35); }
	.gz-bot-talking .gz-bot-mouth-bar { animation: gzBotTalk 0.42s ease-in-out infinite; }
	.gz-bot-talking .gz-bot-mouth-bar:nth-child(2) { animation-delay: 0.14s; }
	.gz-bot-talking .gz-bot-mouth-bar:nth-child(3) { animation-delay: 0.07s; }

	.gz-ai-welcome-paused .gz-bot-float,
	.gz-ai-welcome-paused .gz-bot-turn,
	.gz-ai-welcome-paused .gz-bot-shadow,
	.gz-ai-welcome-paused .gz-bot-face,
	.gz-ai-welcome-paused .gz-bot-glance,
	.gz-ai-welcome-paused .gz-bot-eye,
	.gz-ai-welcome-paused .gz-bot-tip,
	.gz-ai-welcome-paused .gz-bot-mouth-bar { animation-play-state: paused; }

	@media (prefers-reduced-motion: reduce) {
		.gz-bot-float, .gz-bot-turn, .gz-bot-shadow, .gz-bot-face, .gz-bot-glance,
		.gz-bot-eye, .gz-bot-tip, .gz-bot-talking .gz-bot-mouth-bar { animation: none; }
	}
`;

/**
 * AssistantRobot
 *
 * The AI assistant's mascot for the welcome screen: a glossy robot head drawn in SVG and given depth
 * with CSS 3D — it floats over its own shadow and slowly turns in perspective, while the face (on a
 * glass visor) moves a little further than the head for parallax. It blinks, glances around, its
 * antenna pulses, and while `talking` its mouth moves. Shading is gradients on a neutral silver
 * that reads on both the light and dark themes; the glow colours are the chat's blue-to-violet
 * accent.
 */
export function AssistantRobot({ size = 96, talking = false }: AssistantRobotProps) {
	// Unique per instance (docked panel + detached window), without the colons `useId` emits,
	// which break `url(#…)`.
	const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
	const id = (name: string) => `gz-bot-${name}-${uid}`;

	return (
		<div className="gz-bot-stage" style={{ width: size, height: size }} aria-hidden="true">
			<style>{robotCss}</style>
			<svg viewBox="0 0 120 120" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
				<defs>
					{/* Head shell: lit from the top left, falling off to a cooler shade at the bottom. */}
					<linearGradient id={id('shell')} x1="0.2" y1="0" x2="0.8" y2="1">
						<stop offset="0%" stopColor="#ffffff" />
						<stop offset="45%" stopColor="#dfe5f2" />
						<stop offset="100%" stopColor="#99a5c2" />
					</linearGradient>
					{/* Glass visor: deep navy with a faint blue cast. */}
					<linearGradient id={id('visor')} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#1d2547" />
						<stop offset="100%" stopColor="#0b0f22" />
					</linearGradient>
					<linearGradient id={id('accent')} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor={AI_FROM} />
						<stop offset="100%" stopColor={AI_TO} />
					</linearGradient>
					<linearGradient id={id('eye')} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#bfe0ff" />
						<stop offset="100%" stopColor="#5b8cff" />
					</linearGradient>
					{/* Soft glows as plain radial fills — no filters. */}
					<radialGradient id={id('glow')}>
						<stop offset="0%" stopColor="#7aa2ff" stopOpacity="0.55" />
						<stop offset="100%" stopColor="#7aa2ff" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={id('tipGlow')}>
						<stop offset="0%" stopColor={AI_TO} stopOpacity="0.7" />
						<stop offset="100%" stopColor={AI_TO} stopOpacity="0" />
					</radialGradient>
					<radialGradient id={id('shadow')}>
						<stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
						<stop offset="100%" stopColor="#000000" stopOpacity="0" />
					</radialGradient>
				</defs>

				{/* Floor shadow — shrinks as the robot rises. */}
				<ellipse className="gz-bot-shadow" cx="60" cy="111" rx="30" ry="5" fill={`url(#${id('shadow')})`} />
			</svg>

			{/* The robot itself, in its own layer so the 3D turn does not tilt the floor shadow. */}
			<div className="gz-bot-float" style={{ position: 'relative', marginTop: -size }}>
				<div className="gz-bot-turn">
					<svg viewBox="0 0 120 120" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
						{/* Antenna */}
						<rect x="58.5" y="12" width="3" height="16" rx="1.5" fill="#aab4cc" />
						<circle className="gz-bot-tip" cx="60" cy="11" r="9" fill={`url(#${id('tipGlow')})`} />
						<circle cx="60" cy="11" r="4.5" fill={`url(#${id('accent')})`} />
						<circle cx="58.6" cy="9.6" r="1.4" fill="#ffffff" opacity="0.8" />

						{/* Ears */}
						<rect x="10" y="50" width="10" height="26" rx="4" fill={`url(#${id('accent')})`} />
						<rect x="100" y="50" width="10" height="26" rx="4" fill={`url(#${id('accent')})`} />

						{/* Head shell, with a hairline so it holds its edge on a light theme. */}
						<rect
							x="17"
							y="26"
							width="86"
							height="72"
							rx="24"
							fill={`url(#${id('shell')})`}
							stroke="rgba(15, 23, 42, 0.12)"
							strokeWidth="1"
						/>
						{/* Specular highlight on the top-left curve. */}
						<ellipse cx="42" cy="36" rx="18" ry="5.5" fill="#ffffff" opacity="0.7" />

						{/* The face rides a little further than the head: parallax = depth. */}
						<g className="gz-bot-face">
							<rect x="27" y="42" width="66" height="44" rx="16" fill={`url(#${id('visor')})`} />
							{/* Glass reflection across the visor. */}
							<path d="M33 50 Q46 44 62 45 L58 52 Q45 51 35 56 Z" fill="#ffffff" opacity="0.08" />
							{/* Eye glow, then the eyes — which glance, and blink. */}
							<ellipse cx="60" cy="62" rx="30" ry="14" fill={`url(#${id('glow')})`} />
							<g className="gz-bot-glance">
								<rect className="gz-bot-eye" x="43" y="55" width="9" height="13" rx="4.5" fill={`url(#${id('eye')})`} />
								<rect className="gz-bot-eye" x="68" y="55" width="9" height="13" rx="4.5" fill={`url(#${id('eye')})`} />
							</g>
							{/* Mouth: three bars that move while the assistant "speaks". */}
							<g className={talking ? 'gz-bot-talking' : undefined}>
								<rect className="gz-bot-mouth-bar" x="53" y="73" width="3" height="6" rx="1.5" fill="#7aa2ff" />
								<rect className="gz-bot-mouth-bar" x="58.5" y="73" width="3" height="6" rx="1.5" fill="#7aa2ff" />
								<rect className="gz-bot-mouth-bar" x="64" y="73" width="3" height="6" rx="1.5" fill="#7aa2ff" />
							</g>
						</g>
					</svg>
				</div>
			</div>
		</div>
	);
}
