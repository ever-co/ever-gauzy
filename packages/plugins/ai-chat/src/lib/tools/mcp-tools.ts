import { Logger } from '@nestjs/common';
import { importEsm } from '../esm-loader';

const logger = new Logger('AiChatMcpTools');

export interface IMcpToolsHandle {
	tools: Record<string, unknown>;
	close: () => Promise<void>;
}

/**
 * Optionally attach the Gauzy MCP server's tools to the chat agent.
 *
 * Enabled by setting `GAUZY_AI_CHAT_MCP_URL` to the HTTP endpoint of a
 * running Gauzy MCP server. A fresh MCP client is created per chat request
 * and the requesting user's `Authorization` header is forwarded, so the
 * MCP server can act on behalf of that user.
 *
 * SECURITY NOTE: only enable this against an MCP server that validates and
 * uses the per-request bearer token for its own Gauzy API calls. An MCP
 * server logged in with a fixed service account would execute tools with
 * THAT account's permissions, bypassing the requesting user's RBAC.
 * See the plugin README for the current status of the bundled
 * `@gauzy/mcp-server` and this requirement.
 */
export async function createMcpTools(authorizationHeader: string): Promise<IMcpToolsHandle | null> {
	const url = process.env.GAUZY_AI_CHAT_MCP_URL;
	if (!url) return null;

	try {
		const { createMCPClient } = await importEsm<any>('@ai-sdk/mcp');
		const client = await createMCPClient({
			transport: {
				type: 'http',
				url,
				headers: { Authorization: authorizationHeader }
			}
		});
		const tools = await client.tools();
		return {
			tools,
			close: async () => {
				try {
					await client.close();
				} catch (error) {
					logger.warn(`Failed to close MCP client: ${error}`);
				}
			}
		};
	} catch (error) {
		// MCP being down must not take chat down — degrade to built-in tools.
		logger.warn(`MCP tools unavailable (${url}): ${error instanceof Error ? error.message : error}`);
		return null;
	}
}
