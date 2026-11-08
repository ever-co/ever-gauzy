/**
 * The collaboration scopes a token can be granted on its own (`chat:read`, …), and whether the deployment enables a
 * group they reach. Kept apart from the tools so the token check has no dependency on them.
 */
const COLLABORATION_SCOPE = /^(chat|docs|inbox):(read|write)$/;

const GROUP_SWITCHES: Readonly<Record<string, string>> = {
	chat: 'GAUZY_MCP_TOOLS_CHAT',
	docs: 'GAUZY_MCP_TOOLS_DOCS',
	inbox: 'GAUZY_MCP_TOOLS_INBOX'
};

/**
 * Whether a token that lacks the server's required scopes is still admitted for the collaboration tools: it names at
 * least one collaboration scope of a group the deployment enables. Such a token reaches those tools only.
 */
export function admitsCollaborationOnly(scopes: readonly string[] | undefined, env: Record<string, string | undefined> = process.env): boolean {
	return (scopes ?? []).some((scope) => {
		const match = COLLABORATION_SCOPE.exec(scope);
		return !!match && env[GROUP_SWITCHES[match[1]]] === 'true';
	});
}
