---
description: how to do comprehensive file search on Windows
---

# Comprehensive File Search on Windows

The built-in `grep_search` tool can **silently miss files** on Windows, returning no results even for files that clearly contain the search term. This may be related to workspace paths with spaces, long paths, or other Windows-specific issues.

## Steps

// turbo-all

1. Use `findstr /S /N` for comprehensive recursive search across all directories:

```powershell
findstr /S /N "searchTerm" packages\*.ts
```

2. For case-insensitive search, add `/I`:

```powershell
findstr /S /N /I "searchterm" packages\*.ts
```

3. To search multiple file types or directories:

```powershell
findstr /S /N "searchTerm" packages\*.ts apps\*.ts
```

## When to Use

- **Always** use `findstr /S /N` when searching for function/class usage references, because plugins and other gitignored code may reference them
- **Always** use `findstr /S /N` when auditing for security-related patterns across the entire codebase
- Use `grep_search` only for quick searches where completeness is not critical
