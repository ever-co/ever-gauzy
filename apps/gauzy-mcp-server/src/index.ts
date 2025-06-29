#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server";

async function main() {
    const { server, version } = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Gauzy MCP server running on stdio: ${version}`);
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
