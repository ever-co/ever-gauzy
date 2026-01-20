# Flatpak Builder Docker Environment

This Docker container provides a complete Arch Linux environment with all tools needed to build and test Flatpak packages for Gauzy Agent.

## Quick Start

### 1. Build the Docker Image

```bash
# From the repository root
docker build -t gauzy-flatpak-builder -f .docker/flatpak-builder/Dockerfile .docker/flatpak-builder/
```

### 2. Run the Container

```bash
# Run interactively with your project mounted
docker run -it --rm \
  -v "$(pwd):/workspace" \
  gauzy-flatpak-builder
```

## Available Commands

Once inside the container, you have access to these helper commands:

### Validation Commands

```bash
# Validate the Flatpak manifest (YAML syntax + structure)
validate-manifest

# Validate the desktop file
validate-desktop

# Validate the AppStream metadata
validate-metainfo

# Run comprehensive linting on the manifest
lint-manifest
```

### Build Commands

```bash
# Attempt to build (will fail without real .deb file - for validation only)
build-flatpak

# Full build and install (requires real .deb file from releases)
test-flatpak

# Clean build artifacts
clean
```

### Manual Commands

You can also run commands directly:

```bash
# Navigate to the app source
cd /workspace/apps/agent/src

# Lint YAML
yamllint com.ever.gauzyagent.yml

# Validate desktop file
desktop-file-validate com.ever.gauzyagent.desktop

# Validate metainfo
appstream-util validate-relax com.ever.gauzyagent.metainfo.xml

# Run flatpak-builder-lint
flatpak-builder-lint manifest com.ever.gauzyagent.yml

# List installed runtimes
flatpak list
```

## Example Workflow

```bash
# 1. Build the Docker image
docker build -t gauzy-flatpak-builder -f .docker/flatpak-builder/Dockerfile .docker/flatpak-builder/

# 2. Run the container with your project mounted
docker run -it --rm -v "$(pwd):/workspace" gauzy-flatpak-builder

# 3. Inside the container, validate your files
validate-manifest
validate-desktop
validate-metainfo

# 4. Lint the manifest
lint-manifest

# 5. (Optional) Attempt build validation
build-flatpak
```

## What's Included

### Base System

-   Arch Linux (latest)
-   Base development tools

### Flatpak Tools

-   `flatpak` - Flatpak runtime
-   `flatpak-builder` - Build tool
-   `flatpak-builder-lint` - Linting tool
-   `org.flatpak.Builder` - Flathub's builder

### Validation Tools

-   `appstream-glib` - AppStream metadata validation
-   `desktop-file-utils` - Desktop file validation
-   `yamllint` - YAML syntax validation
-   `xmllint` - XML validation

### Runtimes (Pre-installed)

-   `org.freedesktop.Platform//23.08`
-   `org.freedesktop.Sdk//23.08`
-   `org.electronjs.Electron2.BaseApp//23.08`

## Running Specific Commands

You can run specific commands without entering interactive mode:

```bash
# Validate manifest only
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder validate-manifest

# Validate desktop file only
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder validate-desktop

# Validate metainfo only
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder validate-metainfo

# Run all validations
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder bash -c "validate-manifest && validate-desktop && validate-metainfo"
```

## Troubleshooting

### "Project directory not found"

Make sure you're running the container from the repository root and mounting the correct path:

```bash
docker run -it --rm -v "$(pwd):/workspace" gauzy-flatpak-builder
```

### Permission Issues

If you encounter permission issues, you may need to run with user mapping:

```bash
docker run -it --rm -v "$(pwd):/workspace" -u $(id -u):$(id -g) gauzy-flatpak-builder
```

### Flatpak Runtime Issues

The container pre-installs required runtimes, but if you need to reinstall:

```bash
flatpak install -y flathub org.freedesktop.Platform//23.08
flatpak install -y flathub org.freedesktop.Sdk//23.08
flatpak install -y flathub org.electronjs.Electron2.BaseApp//23.08
```

## Building with a Real Release

If you have an actual .deb release file:

1. Update the manifest with correct SHA256 and size:

```bash
# Download the .deb
wget https://github.com/ever-co/ever-gauzy/releases/download/v0.1.0/gauzy-agent-x64-0.1.0.deb

# Get SHA256
sha256sum gauzy-agent-x64-0.1.0.deb

# Get size
stat -c %s gauzy-agent-x64-0.1.0.deb

# Update com.ever.gauzyagent.yml with these values
```

2. Run the full build:

```bash
docker run -it --rm -v "$(pwd):/workspace" gauzy-flatpak-builder test-flatpak
```

## Notes

-   This container is for **validation and testing** purposes
-   Full Flatpak runtime features (like running GUI apps) may not work in Docker
-   For actual app testing, use a VM or physical Linux machine
-   The container uses `--break-system-packages` for pip (Arch Linux requirement)

## Updating the Image

To rebuild with latest packages:

```bash
docker build --no-cache -t gauzy-flatpak-builder -f .docker/flatpak-builder/Dockerfile .docker/flatpak-builder/
```
