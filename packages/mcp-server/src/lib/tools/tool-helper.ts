/**
 * Helper utilities for registering MCP tools with reduced TypeScript type inference overhead.
 *
 * The MCP SDK's server.tool() method uses complex Zod type inference which can cause
 * TypeScript to run out of memory when compiling many tools (324+ tools in this codebase).
 * This helper provides a simpler interface that bypasses the complex generic inference
 * while still providing runtime validation via Zod schemas.
 *
 * Key insight: The memory issue comes from TypeScript computing z.infer<> for each tool's
 * schema at compile time. By using explicit callback types and casting, we avoid this.
 */
import { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Tool callback result type - matches MCP SDK's CallToolResult
 */
export interface ToolResult {
	content: Array<{ type: 'text'; text: string }>;
}

/**
 * Generic args type - callbacks receive this and can destructure as needed
 */
export type ToolArgs = Record<string, unknown>;

/**
 * Standard tool callback that receives parsed args
 */
export type SimpleToolCallback<T extends ToolArgs = ToolArgs> = (args: T) => Promise<ToolResult>;

/**
 * Schema shape type - a record of Zod types
 */
export type SchemaShape = Record<string, z.ZodTypeAny>;

/**
 * Register a tool with explicit schema, bypassing complex type inference.
 * Uses registerTool with inputSchema wrapped in z.object().
 *
 * IMPORTANT: This function uses type casting to avoid TypeScript's complex
 * Zod type inference. The callback will receive validated args at runtime.
 *
 * @param server - The MCP server instance
 * @param name - Tool name
 * @param description - Tool description
 * @param schema - Zod schema shape object (will be wrapped in z.object)
 * @param callback - Tool callback function
 *
 * @example
 * registerTool(server, 'get_tasks', 'Get tasks', {
 *   projectId: z.string().uuid().optional(),
 *   page: z.number().optional().default(1)
 * }, async (args) => {
 *   const { projectId, page } = args as { projectId?: string; page: number };
 *   // ... implementation
 * });
 */
export function registerTool(
	server: McpServer,
	name: string,
	description: string,
	schema: any,
	callback: (args: any) => Promise<ToolResult>
): void {
	// Use registerTool with explicit inputSchema
	// The 'as any' cast is intentional to bypass complex generic inference
	// Runtime validation still works via the Zod schema
	(server.registerTool as any)(
		name,
		{
			description,
			inputSchema: z.object(schema)
		},
		callback
	);
}

/**
 * Register a tool with no parameters.
 *
 * @param server - The MCP server instance
 * @param name - Tool name
 * @param description - Tool description
 * @param callback - Tool callback function
 */
export function registerNoArgsTool(
	server: McpServer,
	name: string,
	description: string,
	callback: () => Promise<ToolResult>
): void {
	(server.registerTool as any)(name, { description }, callback);
}
