import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVersion } from "./common/version.js";

// Import tool registration functions
import { registerTimerTools } from "./tools/timer.js";

export function createServer() {
  const version = getVersion();

  const server = new McpServer({
    name: "gauzy-mcp-server",
    version,
    capabilities: {
      tools: true,
    },
  });

  // Register tools
  registerTimerTools(server);

  return { server, version };
}
