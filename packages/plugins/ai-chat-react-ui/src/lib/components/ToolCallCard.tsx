import { useState, type CSSProperties, type ReactNode } from 'react';
import { chatTheme } from '../chat-theme';

export interface ToolCallCardProps {
	/** Tool name (e.g. 'open_page', 'get_my_tasks'). */
	toolName: string;
	/** Part state from the AI SDK ('input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'approval-requested' | …). */
	state: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
	/** Approve / reject callbacks — present only while approval is pending. */
	onApprove?: () => void;
	onReject?: () => void;
}

/** Human-friendly labels for the built-in tools. */
const TOOL_LABELS: Record<string, string> = {
	list_pages: 'Listing pages',
	open_page: 'Opening page',
	read_page: 'Reading page',
	fill_form: 'Filling form',
	submit_form: 'Submitting form',
	get_my_tasks: 'Fetching your tasks',
	search_tasks: 'Searching tasks',
	create_task: 'Creating task',
	get_projects: 'Fetching projects',
	get_employees: 'Fetching employees',
	get_organization_contacts: 'Fetching contacts',
	get_my_daily_plans: 'Fetching daily plans',
	get_timer_status: 'Checking timer',
	start_timer: 'Starting timer',
	stop_timer: 'Stopping timer',
	get_invoices: 'Fetching invoices',
	get_expenses: 'Fetching expenses',
	get_incomes: 'Fetching income',
	get_time_off_requests: 'Fetching time off'
};

/**
 * ToolCallCard
 *
 * One agent tool invocation inside the message stream: spinner while running,
 * check/cross when done, an expandable detail area (input/output JSON), and
 * Approve / Reject buttons when the tool requires the user's explicit approval.
 *
 * Deliberately chrome-less. As a bordered, filled card each step read as its own
 * separate object stacked above the answer; the steps belong TO the answer, so
 * they now sit on the panel with no box of their own, indented to the same left
 * edge as the bubble text so the whole turn reads as one block. The only state
 * that still draws itself is `approval-requested` — it is a decision the user has
 * to notice, and a row that looks like all the others would not be noticed.
 */
export function ToolCallCard({ toolName, state, input, output, errorText, onApprove, onReject }: ToolCallCardProps) {
	const [expanded, setExpanded] = useState(false);

	const label = TOOL_LABELS[toolName] ?? toolName;
	const isRunning = state === 'input-streaming' || state === 'input-available';
	const isError = state === 'output-error';
	const isApproval = state === 'approval-requested';

	const cardStyle: CSSProperties = {
		// Aligns the row with the text inside the assistant bubble beside it
		// (11px of bubble padding + its 1px hairline).
		padding: isApproval ? '7px 10px 7px 12px' : '3px 12px',
		margin: isApproval ? '5px 0' : '2px 0 5px',
		border: 'none',
		// A left rule, not a box: the approval state keeps an edge to catch the eye
		// without going back to a card.
		borderLeft: isApproval ? `2px solid ${chatTheme.accent}` : 'none',
		borderRadius: isApproval ? 6 : 0,
		backgroundColor: isApproval ? chatTheme.accentLight : 'transparent',
		fontSize: chatTheme.fontSizeMessage,
		lineHeight: 1.6,
		color: chatTheme.textSecondary,
		animation: 'fadeIn 0.2s ease'
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 7,
		cursor: 'pointer',
		userSelect: 'none'
	};

	const detailStyle: CSSProperties = {
		marginTop: 5,
		maxHeight: 180,
		overflow: 'auto',
		backgroundColor: chatTheme.surfaceDeep,
		border: `1px solid ${chatTheme.borderSoft}`,
		borderRadius: 8,
		padding: '8px 9px',
		fontFamily: chatTheme.fontFamilyMono,
		fontSize: chatTheme.fontSizeMessage,
		lineHeight: 1.65,
		color: chatTheme.codeText,
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word'
	};

	const approvalBarStyle: CSSProperties = {
		display: 'flex',
		gap: 8,
		marginTop: 8
	};

	const approveBtn: CSSProperties = {
		flex: 1,
		padding: '6px 10px',
		borderRadius: chatTheme.controlRadius,
		border: '1px solid transparent',
		backgroundColor: chatTheme.green,
		color: '#ffffff',
		fontWeight: chatTheme.fontWeightSemibold,
		fontSize: chatTheme.fontSizeSmall,
		fontFamily: chatTheme.fontFamily,
		lineHeight: 1.5,
		cursor: 'pointer'
	};

	const rejectBtn: CSSProperties = {
		...approveBtn,
		backgroundColor: 'transparent',
		border: `1px solid ${chatTheme.border}`,
		color: chatTheme.textPrimary
	};

	let statusIcon: ReactNode;
	if (isRunning) {
		statusIcon = <Spinner />;
	} else if (isError) {
		statusIcon = <span style={{ color: chatTheme.red }}>✕</span>;
	} else if (isApproval) {
		statusIcon = <span style={{ color: chatTheme.accent }}>⚠</span>;
	} else {
		statusIcon = <span style={{ color: chatTheme.green }}>✓</span>;
	}

	return (
		<div style={cardStyle}>
			<div
				className="gz-ai-chat-tool-row"
				style={headerStyle}
				onClick={() => setExpanded((v) => !v)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						setExpanded((v) => !v);
					}
				}}
				role="button"
				tabIndex={0}
				aria-expanded={expanded}
			>
				{statusIcon}
				<span
					className="gz-ai-chat-tool-label"
					style={{ color: chatTheme.link, fontWeight: chatTheme.fontWeightMedium }}
				>
					{label}
				</span>
				{isApproval && <span style={{ color: chatTheme.textSecondary }}>— needs your approval</span>}
				{/* Beside the label, not flung to the far edge: it is the label's own
				    disclosure marker, and across the panel width it read as unrelated. */}
				<span style={{ marginLeft: -3, opacity: 0.5, fontSize: '0.625rem' }}>{expanded ? '▾' : '▸'}</span>
			</div>

			{isApproval && (
				<div style={approvalBarStyle}>
					<button style={approveBtn} onClick={onApprove} aria-label={`Approve ${label}`}>
						Approve
					</button>
					<button style={rejectBtn} onClick={onReject} aria-label={`Reject ${label}`}>
						Reject
					</button>
				</div>
			)}

			{expanded && (
				<div style={detailStyle}>
					{input !== undefined && `Input:\n${safeStringify(input)}`}
					{output !== undefined && `\n\nResult:\n${safeStringify(output)}`}
					{errorText && `\n\nError:\n${errorText}`}
				</div>
			)}
		</div>
	);
}

function safeStringify(value: unknown): string {
	try {
		return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function Spinner() {
	const style: CSSProperties = {
		width: 10,
		height: 10,
		border: `2px solid ${chatTheme.border}`,
		borderTopColor: chatTheme.accent,
		borderRadius: '50%',
		animation: 'gzSpin 0.8s linear infinite',
		flexShrink: 0
	};
	return (
		<>
			<style>{`@keyframes gzSpin { to { transform: rotate(360deg); } }`}</style>
			<span style={style} aria-label="Running" />
		</>
	);
}
