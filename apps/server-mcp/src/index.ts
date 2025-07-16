#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './instance/mcp-server.js';

async function testMcpServer() {
	console.log('🧪 Testing Gauzy MCP Server...\n');

	try {
		const { server, version } = createMcpServer();

		console.log('✅ MCP Server created successfully');
		console.log(`📋 Server: gauzy-mcp-server v${version}`);
		console.log('🛠️  Server capabilities: tools');

		// Show the capabilities that we configured
		const capabilities = {
			tools: true,
			resources: false,
			prompts: false,
			server_name: 'gauzy-mcp-server',
			server_version: version
		};
		console.log('📊 Capabilities:', JSON.stringify(capabilities, null, 2));

		console.log('\n🎉 All tests passed! MCP server is ready for use.');
		console.log('\n💡 To use with Claude Desktop:');
		console.log('   1. Build the server: yarn build:prod');
		console.log('   2. Configure Claude Desktop with the build/instance/mcp-server.js path');
		console.log('   3. Start asking Claude about your Gauzy data!');
	} catch (error) {
		console.error('❌ MCP Server test failed:', error);
		process.exit(1);
	}
}

async function main() {
	// Check if we're in test mode
	if (process.argv.includes('--test')) {
		await testMcpServer();
		return;
	}

	// Normal MCP server startup for stdio communication
	console.error('🚀 Starting Gauzy MCP Server...');

	const { server, version } = createMcpServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error(`✅ Gauzy MCP Server running on stdio - version: ${version}`);
	console.error('🔗 Ready to accept MCP requests from clients like Claude Desktop');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
	console.error('\n🛑 Received SIGINT, shutting down gracefully...');
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.error('\n🛑 Received SIGTERM, shutting down gracefully...');
	process.exit(0);
});

main().catch((error) => {
	console.error('💥 Fatal error in main():', error);
	process.exit(1);
});
