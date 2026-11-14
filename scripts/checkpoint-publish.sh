#!/usr/bin/env bash
set -euo pipefail

# Creates a verified local archive backup (.backups/) and an annotated Git checkpoint tag
# before publishing code to GitHub. Pass --push to push main and checkpoint tags to origin.

PUSH_TO_ORIGIN=false
if [[ "${1:-}" == "--push" ]]; then
  PUSH_TO_ORIGIN=true
fi

echo "==> Running FinTrack verification gates (lint, rules, tests)..."
npm run lint
npm run lint:rules
npm test

STAMP="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p .backups

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'init')"
  TAG_NAME="checkpoint-${STAMP}-${SHORT_SHA}"
  BACKUP_FILE=".backups/fintrack-source-${TAG_NAME}.tar.gz"

  echo "==> Creating source backup archive: ${BACKUP_FILE}"
  tar --exclude='./node_modules' --exclude='./dist' --exclude='./.backups' --exclude='./.git' \
    -czf "${BACKUP_FILE}" .

  echo "==> Creating annotated Git checkpoint tag: ${TAG_NAME}"
  git tag -a "${TAG_NAME}" -m "FinTrack pre-publish checkpoint ${TAG_NAME}"

  if [[ "${PUSH_TO_ORIGIN}" == "true" ]]; then
    echo "==> Pushing main branch and checkpoint tag ${TAG_NAME} to origin..."
    git push origin main
    git push origin "refs/tags/${TAG_NAME}"
    echo "==> Published! Restore anytime via:"
    echo "    Git CLI:        git checkout ${TAG_NAME}"
    echo "    GitHub Actions: Run 'Restore FinTrack Checkpoint' with checkpoint_ref=${TAG_NAME}"
  else
    echo "==> Checkpoint ready locally:"
    echo "    Tag:    ${TAG_NAME}"
    echo "    Backup: ${BACKUP_FILE}"
    echo "    Push with: git push origin main --follow-tags"
  fi
else
  BACKUP_FILE=".backups/fintrack-source-${STAMP}.tar.gz"
  tar --exclude='./node_modules' --exclude='./dist' --exclude='./.backups' \
    -czf "${BACKUP_FILE}" .
  echo "==> Created local source archive: ${BACKUP_FILE}"
fi
