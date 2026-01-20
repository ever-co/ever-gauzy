# Flatpak Build and Distribution Guide

This guide explains how to build and test the Gauzy Agent Flatpak locally, and how to submit it to Flathub for distribution.

## Overview

Gauzy Agent is now available as a Flatpak package, providing a sandboxed and universally compatible way to run the application on Linux distributions. This is a pilot implementation for issue [#9347](https://github.com/ever-co/ever-gauzy/issues/9347) before rolling out Flatpak support to other Electron apps in the Gauzy ecosystem.

## Prerequisites

Before building the Flatpak, ensure you have the following installed:

### Required Software

1. **Flatpak** (version 1.12 or later)

    ```bash
    # For Ubuntu/Debian
    sudo apt install flatpak

    # For Fedora
    sudo dnf install flatpak

    # For Arch Linux
    sudo pacman -S flatpak
    ```

2. **Flatpak Builder**

    ```bash
    flatpak install -y flathub org.flatpak.Builder
    ```

3. **Flathub Repository**
    ```bash
    flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
    ```

### Runtime and SDK

The required runtime and SDK will be automatically installed during the build process, but you can pre-install them:

```bash
flatpak install -y flathub org.freedesktop.Platform//23.08
flatpak install -y flathub org.freedesktop.Sdk//23.08
flatpak install -y flathub org.electronjs.Electron2.BaseApp//23.08
```

## Building Locally

### 1. Navigate to the Agent Source Directory

```bash
cd apps/agent/src
```

### 2. Prepare the Build

Before building, you need to update the `com.ever.gauzyagent.yml` manifest file with the correct SHA256 hash and size of the latest release:

```bash
# Download the latest .deb package
wget https://github.com/ever-co/ever-gauzy/releases/download/v0.1.0/gauzy-agent-x64-0.1.0.deb

# Get the SHA256 hash
sha256sum gauzy-agent-x64-0.1.0.deb

# Get the file size
stat --format="%s" gauzy-agent-x64-0.1.0.deb
```

Update the values in `com.ever.gauzyagent.yml` under the `extra-data` section:

-   Replace `REPLACE_WITH_ACTUAL_SHA256` with the SHA256 hash
-   Replace `REPLACE_WITH_ACTUAL_SIZE` with the file size in bytes

### 3. Build the Flatpak

```bash
flatpak run --command=flathub-build org.flatpak.Builder --install com.ever.gauzyagent.yml
```

This command will:

-   Download all required dependencies
-   Build the Flatpak package
-   Install it locally for testing

### 4. Test the Flatpak

Run the application to ensure it works correctly:

```bash
flatpak run com.ever.gauzyagent
```

Test the following features:

-   Application launches successfully
-   Time tracking functionality works
-   Screenshot and activity monitoring features function
-   Network connectivity to Gauzy platform
-   System tray integration
-   Notifications work properly

### 5. Run the Linter

Validate the manifest and repository before submission:

```bash
# Lint the manifest
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest com.ever.gauzyagent.yml

# Build the repo for linting
flatpak run --command=flathub-build org.flatpak.Builder com.ever.gauzyagent.yml
flatpak install --user -y ./repo com.ever.gauzyagent

# Lint the repo
flatpak run --command=flatpak-builder-lint org.flatpak.Builder repo repo
```

Address any errors or warnings reported by the linter. Some errors may require exceptions - consult the [linter documentation](https://docs.flathub.org/docs/for-app-authors/linter).

## Debugging

### Running with Debug Output

```bash
flatpak run --env=G_MESSAGES_DEBUG=all com.ever.gauzyagent
```

### Accessing the Sandbox

To inspect the sandboxed environment:

```bash
flatpak run --command=sh com.ever.gauzyagent
```

### Common Issues

**Issue**: Application fails to start

-   Check the journal logs: `journalctl --user -xe | grep gauzy-agent`
-   Verify all permissions in the manifest are correct

**Issue**: Network connectivity problems

-   Ensure `--share=network` is in the finish-args
-   Check firewall settings

**Issue**: Screenshots not working

-   Verify `--device=all` permission is granted
-   Check if the user has necessary system permissions

## Submitting to Flathub

### Prerequisites for Submission

1. Ensure you have a GitHub account with 2FA enabled
2. Read the [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)
3. Verify all files pass the linter without critical errors
4. Test the application thoroughly

### Submission Process

1. **Fork the Flathub Repository**

    Visit [https://github.com/flathub/flathub/fork](https://github.com/flathub/flathub/fork) and uncheck "Copy the master branch only"

2. **Clone Your Fork**

    ```bash
    git clone --branch=new-pr git@github.com:YOUR_USERNAME/flathub.git
    cd flathub
    ```

3. **Create a Submission Branch**

    ```bash
    git checkout -b gauzy-agent-submission new-pr
    ```

4. **Add Required Files**

    Copy the following files from `apps/agent/src/` to the submission directory:

    - `com.ever.gauzyagent.yml`
    - `com.ever.gauzyagent.desktop`
    - `com.ever.gauzyagent.metainfo.xml`
    - Icon files from `icons/linux/` directory

    ```bash
    # From the repository root
    cp apps/agent/src/com.ever.gauzyagent.yml .
    cp apps/agent/src/com.ever.gauzyagent.desktop .
    cp apps/agent/src/com.ever.gauzyagent.metainfo.xml .
    mkdir -p icons
    cp -r apps/agent/src/icons/linux/* icons/
    ```

5. **Commit and Push**

    ```bash
    git add com.ever.gauzyagent.yml com.ever.gauzyagent.desktop com.ever.gauzyagent.metainfo.xml icons/
    git commit -m "Add com.ever.gauzyagent"
    git push origin gauzy-agent-submission
    ```

6. **Open Pull Request**

    Go to GitHub and open a pull request against the `new-pr` base branch (NOT `master`) of the `flathub/flathub` repository.

    Title: `Add com.ever.gauzyagent`

7. **Review Process**

    - Respond to reviewer comments promptly
    - Make requested changes in the same branch
    - Do not close and reopen the PR
    - Wait for approval and test build

8. **Test Build**

    Once reviewers approve, they may trigger a test build by commenting `bot, build` on the PR.

9. **Approval and Merge**

    After approval, the PR will be merged into a new repository under the Flathub organization. You'll receive an invitation to maintain the repository.

### Post-Submission

Once your submission is approved:

1. Accept the GitHub repository invitation (within one week)
2. The app will be built and published on Flathub
3. Users can install it via: `flatpak install flathub com.ever.gauzyagent`

## Maintaining the Flatpak

### Updating to New Versions

1. Update the version in `com.ever.gauzyagent.metainfo.xml` releases section
2. Update the URL, SHA256, and size in `com.ever.gauzyagent.yml`
3. Commit and push to the Flathub repository
4. The app will be automatically built and published

### Using External Data Checker

The manifest includes `x-checker-data` configuration for automatic update detection. The Flathub infrastructure will check for new releases and can create PRs automatically.

## Configuration Details

### Permissions Explained

The Flatpak uses the following permissions:

-   `--share=ipc` and `--socket=x11/wayland`: GUI access
-   `--socket=pulseaudio`: Audio for notifications
-   `--share=network`: Connect to Gauzy platform
-   `--device=all`: Screen capture and activity monitoring
-   `--filesystem=host`: Access to user files for database and configuration
-   `--talk-name=org.freedesktop.Notifications`: Desktop notifications
-   System tray permissions: StatusNotifier protocol support

### Base Application

This Flatpak uses `org.electronjs.Electron2.BaseApp` which provides:

-   Electron framework binaries
-   Common libraries and dependencies
-   Zypak for sandboxing Chromium

## Resources

-   [Flathub Documentation](https://docs.flathub.org/)
-   [Flatpak Documentation](https://docs.flatpak.org/)
-   [Electron BaseApp](https://github.com/flathub/org.electronjs.Electron2.BaseApp)
-   [AppStream Metadata Guidelines](https://www.freedesktop.org/software/appstream/docs/)
-   [Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/)

## Support

For issues related to the Flatpak build:

-   Open an issue at [https://github.com/ever-co/ever-gauzy/issues](https://github.com/ever-co/ever-gauzy/issues)
-   Tag with `flatpak` label
-   Reference issue #9347

For Flathub-specific questions:

-   [Flathub Matrix Channel](https://matrix.to/#/#flathub:matrix.org)
-   [Flathub Discourse](https://discourse.flathub.org/)
