# Dockerfile for Flatpak development and testing
# Based on Arch Linux with Flatpak support
FROM archlinux:latest

LABEL maintainer="Ever Co. LTD"
LABEL description="Flatpak build and test environment for Gauzy Agent"

# Update system and install base packages
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm \
    base-devel \
    git \
    wget \
    curl \
    flatpak \
    flatpak-builder \
    python \
    python-pip \
    python-gobject \
    appstream-glib \
    desktop-file-utils \
    ostree \
    fuse2 \
    xmlto \
    docbook-xsl \
    vim \
    nano \
    jq \
    yamllint

# Install flatpak-builder-lint for manifest validation
RUN pip install --break-system-packages flatpak-builder-lint

# Add Flathub repository
RUN flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Install Flatpak Builder from Flathub
RUN flatpak install -y flathub org.flatpak.Builder

# Install required runtimes and SDKs for building
RUN flatpak install -y flathub org.freedesktop.Platform//23.08 && \
    flatpak install -y flathub org.freedesktop.Sdk//23.08 && \
    flatpak install -y flathub org.electronjs.Electron2.BaseApp//23.08

# Create working directory
WORKDIR /workspace

# Create a helper script for common tasks
RUN echo '#!/bin/bash\n\
echo "================================="\n\
echo "Flatpak Builder Environment"\n\
echo "================================="\n\
echo ""\n\
echo "Available commands:"\n\
echo "  validate-manifest    - Validate the Flatpak manifest"\n\
echo "  validate-desktop     - Validate the desktop file"\n\
echo "  validate-metainfo    - Validate the AppStream metadata"\n\
echo "  lint-manifest        - Run flatpak-builder-lint on manifest"\n\
echo "  build-flatpak        - Build the Flatpak package"\n\
echo "  test-flatpak         - Build and install for testing"\n\
echo "  clean                - Clean build artifacts"\n\
echo ""\n\
echo "Working directory: /workspace"\n\
echo "Your project should be mounted here"\n\
echo "================================="\n\
' > /usr/local/bin/flatpak-help && chmod +x /usr/local/bin/flatpak-help

# Script to validate manifest
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Validating YAML syntax..."\n\
yamllint com.ever.gauzyagent.yml || true\n\
echo ""\n\
echo "Linting Flatpak manifest..."\n\
flatpak-builder-lint manifest com.ever.gauzyagent.yml\n\
' > /usr/local/bin/validate-manifest && chmod +x /usr/local/bin/validate-manifest

# Script to validate desktop file
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Validating desktop file..."\n\
desktop-file-validate com.ever.gauzyagent.desktop\n\
' > /usr/local/bin/validate-desktop && chmod +x /usr/local/bin/validate-desktop

# Script to validate metainfo
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Validating AppStream metadata..."\n\
appstream-util validate-relax com.ever.gauzyagent.metainfo.xml\n\
' > /usr/local/bin/validate-metainfo && chmod +x /usr/local/bin/validate-metainfo

# Script to lint manifest
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Running flatpak-builder-lint..."\n\
flatpak-builder-lint manifest com.ever.gauzyagent.yml\n\
' > /usr/local/bin/lint-manifest && chmod +x /usr/local/bin/lint-manifest

# Script to build flatpak (validation only - will fail without actual .deb)
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Building Flatpak..."\n\
echo "Note: This will fail at the extra-data step without a real .deb file"\n\
echo "This is expected for validation purposes"\n\
echo ""\n\
flatpak run --command=flatpak-builder org.flatpak.Builder \\\n\
  --force-clean \\\n\
  --disable-download \\\n\
  build-dir \\\n\
  com.ever.gauzyagent.yml || true\n\
' > /usr/local/bin/build-flatpak && chmod +x /usr/local/bin/build-flatpak

# Script to test flatpak (if you have a real .deb)
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Building and installing Flatpak for testing..."\n\
flatpak run --command=flathub-build org.flatpak.Builder --install com.ever.gauzyagent.yml\n\
' > /usr/local/bin/test-flatpak && chmod +x /usr/local/bin/test-flatpak

# Script to clean build artifacts
RUN echo '#!/bin/bash\n\
cd /workspace/apps/agent/src || exit 1\n\
echo "Cleaning build artifacts..."\n\
rm -rf build-dir .flatpak-builder repo\n\
echo "Done!"\n\
' > /usr/local/bin/clean && chmod +x /usr/local/bin/clean

# Set up entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/bin/bash"]
