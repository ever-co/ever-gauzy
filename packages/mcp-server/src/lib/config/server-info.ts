export const SERVER_INFO = {
    name: 'Gauzy MCP Server',
    capabilities: {
        tools: true,
        resources: false,
        prompts: false
    },
    features: {
        schemaValidation: true,
        bulkOperations: true,
        relationSupport: true,
        paginationSupport: true,
        statisticsSupport: true,
        assignmentOperations: true,
        authentication: true,
        tokenRefresh: true
    }
} as const;
