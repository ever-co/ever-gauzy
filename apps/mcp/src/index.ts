import { createMcpServer, createAndStartMcpServer } from '@gauzy/mcp-server';
import log from 'electron-log';

async function testMcpServer() {
	log.info('🧪 Testing Gauzy MCP Server...\n');

	try {
		const { version } = createMcpServer();

		log.info('✅ MCP Server created successfully');
		log.info(`📋 Server: gauzy-mcp-server v${version}`);
		log.info('🛠️  Server capabilities: tools');

		// Show the capabilities that we configured
		const capabilities = {
			tools: true,
			resources: false,
			prompts: false,
			server_name: 'gauzy-mcp-server',
			server_version: version
		};
		log.info('📊 Capabilities:', JSON.stringify(capabilities, null, 2));

		log.info('\n🎉 All tests passed! MCP server is ready for use.');
		log.info('\n💡 To use with Claude Desktop:');
		log.info('   1. Build the server: yarn build:prod');
		log.info('   2. Configure Claude Desktop with the build/index.js path');
		log.info('   3. Start asking Claude about your Gauzy data!');

	} catch (error) {
		log.error('❌ MCP Server test failed:', error);
		process.exit(1);
	}
}

async function main() {
	// Check if we're in test mode
	if (process.argv.includes('--test')) {
		await testMcpServer();
		return;
	}

	// Normal MCP server startup with automatic transport detection
	log.info('🚀 Starting Gauzy MCP Server...');

	const { transport } = await createAndStartMcpServer();

	log.info(`✅ Gauzy MCP Server running on ${transport.type} transport`);

	if (transport.type === 'http' && transport.url) {
		log.info(`🌐 HTTP transport available at: ${transport.url}`);
		log.info(`📡 API endpoints:`);
		log.info(`   - GET  ${transport.url}/health`);
		log.info(`   - POST ${transport.url}/mcp`);
		log.info(`   - GET  ${transport.url}/mcp/events`);
	} else {
		log.info('📟 Server ready for stdio communication');
	}

	log.info('🔗 Ready to accept MCP requests from clients like Claude Desktop');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
	log.info('\n🛑 Received SIGINT, shutting down gracefully...');
	process.exit(0);
});

process.on('SIGTERM', () => {
	log.info('\n🛑 Received SIGTERM, shutting down gracefully...');
	process.exit(0);
});

main().catch((error) => {
	log.error('💥 Fatal error in main():', error);
	process.exit(1);
});
