# MCP Tools Registry Configuration

This directory contains the centralized configuration for all MCP (Model Context Protocol) tools available in the Gauzy MCP Server.

## Files

### `tools-registry.ts`

The main configuration file that exports:

-   **`TOOLS_REGISTRY`**: Complete registry of all available tools organized by category
-   **Helper functions**: Utility functions for working with the tool registry

## Usage

### Importing the Registry

```typescript
import {
	TOOLS_REGISTRY,
	getToolCounts,
	getTotalToolCount,
	getToolsByCategory,
	isToolRegistered,
	getToolCategory
} from '../config/tools-registry.js';
```

### Common Use Cases

#### Get all tools in a category

```typescript
const authTools = getToolsByCategory('authentication');
// Returns: ['login', 'logout', 'get_auth_status', ...]
```

#### Check if a tool exists

```typescript
const exists = isToolRegistered('get_employees');
// Returns: true
```

#### Get tool statistics

```typescript
const counts = getToolCounts();
// Returns: { authentication: 5, employees: 16, tasks: 16, ... }

const total = getTotalToolCount();
// Returns: total number of tools across all categories
```

## Maintenance

### Adding New Tools

When you add new tools to the MCP server:

1. **Register the tool** in your tool file (e.g., `src/tools/employees.ts`)
2. **Add the tool name** to the appropriate category in `TOOLS_REGISTRY`
3. **Create a new category** if needed for new tool types

### Example: Adding a new employee tool

1. Implement the tool:

```typescript
// In src/tools/employees.ts
server.tool('archive_employee', 'Archive an employee', { ... }, async () => {
  // Implementation
});
```

2. Update the registry:

```typescript
// In src/config/tools-registry.ts
export const TOOLS_REGISTRY: ToolRegistry = {
	employees: [
		'get_employees',
		'create_employee',
		// ... existing tools
		'archive_employee' // Add new tool here
	]
	// ... other categories
};
```

### Adding New Categories

For completely new types of tools:

```typescript
export const TOOLS_REGISTRY: ToolRegistry = {
	// ... existing categories
	reporting: ['generate_report', 'get_report_templates', 'export_report']
};
```

## Benefits

-   **Single Source of Truth**: All tool definitions in one place
-   **Type Safety**: TypeScript interfaces ensure consistency
-   **Easy Maintenance**: Add tools in one location, use everywhere
-   **Utility Functions**: Built-in helpers for common operations
-   **Reusability**: Import and use across multiple files

## Migration from Hardcoded Lists

If you have hardcoded tool lists elsewhere in the codebase, replace them with imports from this registry:

**Before:**

```typescript
const tools = {
  authentication: ['login', 'logout', ...],
  employees: ['get_employees', ...]
};
```

**After:**

```typescript
import { TOOLS_REGISTRY } from '../config/tools-registry.js';
const tools = TOOLS_REGISTRY;
```
