#!/bin/bash
set -e

# Show welcome message
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   Flatpak Builder Environment for Gauzy Agent             ║"
echo "║   Arch Linux + Flatpak Tools                              ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if workspace is mounted
if [ ! -d "/workspace/apps/agent/src" ]; then
	echo "⚠️  Warning: Project directory not found at /workspace"
	echo "   Make sure to mount your project with:"
	echo "   docker run -v /path/to/ever-gauzy:/workspace ..."
	echo ""
fi

# Show available commands
flatpak-help

# Execute the command passed to docker run
exec "$@"
