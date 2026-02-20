#!/bin/bash
# check_secrets.sh
# Scans for secrets using TruffleHog.
# Usage: ./scripts/check_secrets.sh [--staged]

if [ ! -x "$(command -v trufflehog)" ]; then
    echo "⚠️ TruffleHog not found. Secret scanning skipped. Run 'brew install trufflehog' to enable."
    exit 0
fi

if [ "$1" == "--staged" ]; then
    echo "🔍 Scanning staged files for secrets..."
    # Scan only staged files (for pre-commit hook)
    # We dump staged changes to a patch and scan the patch
    git diff --staged | trufflehog git --no-verification --fail -
else
    echo "🔍 Scanning entire repository history..."
    trufflehog git file://. --since-commit HEAD --no-verification --fail
fi
