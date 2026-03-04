<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# File Search on Windows

> **IMPORTANT**: The built-in `grep_search` tool (ripgrep) can **silently miss files** on Windows, returning no results even for files that clearly contain the search term. This may be related to workspace paths with spaces, long paths, or other Windows-specific issues. Always verify critical searches with `findstr /S`.

## Recommended Approach

Always use `findstr /S` for comprehensive code searches to ensure **all** files are covered:

```powershell
# Search recursively in all .ts files under packages/
findstr /S /N "searchTerm" packages\*.ts

# Search with case-insensitivity
findstr /S /N /I "searchterm" packages\*.ts

# Search across all source files
findstr /S /N "searchTerm" packages\*.ts apps\*.ts
```

## When to Use Each Tool

| Tool            | Use When                                                           |
| --------------- | ------------------------------------------------------------------ |
| `grep_search`   | Quick searches — but always verify critical results with `findstr` |
| `findstr /S /N` | **Comprehensive searches** where completeness is essential         |
| `find_by_name`  | Finding files by name/pattern                                      |
