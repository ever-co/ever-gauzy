# Quick Start: Testing Flatpak with Docker

This guide shows you how to quickly test the Flatpak build using Docker on your M4 Mac.

## Prerequisites

-   Docker Desktop for Mac installed and running
-   Terminal access

## Option 1: Using Make (Easiest)

### 1. Build the Docker image

```bash
make -f Makefile.flatpak build
```

### 2. Validate all files

```bash
make -f Makefile.flatpak validate-all
```

### 3. Open interactive shell (for manual testing)

```bash
make -f Makefile.flatpak run
```

Inside the container, you can use:

-   `validate-manifest` - Check the Flatpak manifest
-   `validate-desktop` - Check the desktop file
-   `validate-metainfo` - Check the AppStream metadata
-   `lint-manifest` - Run comprehensive linting

### Other useful commands

```bash
# Just lint the manifest
make -f Makefile.flatpak lint

# Clean up when done
make -f Makefile.flatpak clean

# See all available commands
make -f Makefile.flatpak help
```

## Option 2: Using Docker Compose

### 1. Start the environment

```bash
cd .docker/flatpak-builder
docker-compose up -d
```

### 2. Open a shell

```bash
docker-compose exec flatpak-builder bash
```

### 3. Run validations inside the container

```bash
validate-manifest
validate-desktop
validate-metainfo
```

### 4. Stop when done

```bash
docker-compose down
```

## Option 3: Direct Docker Commands

### 1. Build the image

```bash
docker build -t gauzy-flatpak-builder -f .docker/flatpak-builder/Dockerfile .docker/flatpak-builder/
```

### 2. Run validations

```bash
# Validate manifest
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder validate-manifest

# Validate desktop file
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder validate-desktop

# Validate metainfo
docker run --rm -v "$(pwd):/workspace" gauzy-flatpak-builder validate-metainfo
```

### 3. Interactive shell

```bash
docker run -it --rm -v "$(pwd):/workspace" gauzy-flatpak-builder
```

## What Gets Validated

✅ **Flatpak Manifest** (`com.ever.gauzyagent.yml`)

-   YAML syntax
-   Flatpak-specific structure
-   Dependencies and permissions
-   Build configuration

✅ **Desktop File** (`com.ever.gauzyagent.desktop`)

-   Desktop Entry specification compliance
-   Required fields present
-   Category and MIME type validation

✅ **AppStream Metadata** (`com.ever.gauzyagent.metainfo.xml`)

-   XML syntax
-   AppStream specification compliance
-   Metadata completeness
-   Screenshot URLs (format check)

## Expected Results

When you run the validations, you should see:

### Successful Validation

```
✅ YAML syntax: Valid
✅ Desktop file: Valid
✅ AppStream metadata: Valid
✅ Flatpak manifest structure: Valid
```

### Common Warnings (OK to ignore)

-   Line length warnings in YAML (cosmetic)
-   Screenshot URL warnings (URLs are placeholders)
-   Some AppStream relaxed validation notices

### Errors to Fix

-   Missing required fields
-   Invalid XML/YAML syntax
-   Incorrect permission formats
-   Wrong file paths

## Testing Workflow

```bash
# 1. Build the Docker image (one time)
make -f Makefile.flatpak build

# 2. Validate your changes
make -f Makefile.flatpak validate-all

# 3. If you make changes to the manifest/desktop/metainfo files
#    Re-run validation
make -f Makefile.flatpak validate-all

# 4. For detailed linting
make -f Makefile.flatpak lint

# 5. Clean up when done
make -f Makefile.flatpak clean
```

## Limitations

⚠️ **What Docker CAN do:**

-   ✅ Validate YAML, XML, desktop file syntax
-   ✅ Run flatpak-builder-lint
-   ✅ Check manifest structure
-   ✅ Verify file formats

⚠️ **What Docker CANNOT do:**

-   ❌ Full Flatpak build (needs systemd, proper Linux kernel)
-   ❌ Run the actual Flatpak app
-   ❌ Test GUI features
-   ❌ Test Wayland/X11 integration

For full testing, you'll need:

-   A Linux VM (UTM with Arch Linux)
-   GitHub Actions (automated testing)
-   A physical Linux machine

## Troubleshooting

### "Permission denied" errors

```bash
# Run with user mapping
docker run --rm -v "$(pwd):/workspace" -u $(id -u):$(id -g) gauzy-flatpak-builder validate-all
```

### "Project directory not found"

Make sure you're in the repository root when running commands.

### Image build fails

```bash
# Try rebuilding without cache
make -f Makefile.flatpak rebuild
```

## Next Steps

After validation passes:

1. ✅ Push your branch to GitHub
2. ✅ GitHub Actions will run automated tests
3. ✅ Create the pull request
4. ✅ When ready, submit to Flathub (follow FLATPAK.md)

## Quick Reference

```bash
# Most common workflow
make -f Makefile.flatpak build          # Build image (first time)
make -f Makefile.flatpak validate-all   # Validate everything
make -f Makefile.flatpak run            # Interactive shell
```
