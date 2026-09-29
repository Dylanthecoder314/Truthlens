#!/usr/bin/env bash
# Store API keys in the macOS Keychain instead of files.
#
#   scripts/vault.sh set    [NAME]   store/replace a key (hidden prompt)
#   scripts/vault.sh check  [NAME]   say whether a key is stored (never prints it)
#   scripts/vault.sh remove [NAME]   delete a stored key
#   scripts/vault.sh run CMD...      run CMD with every stored key exported as env vars
#
# NAME defaults to GROQ_API_KEY.
set -euo pipefail

SERVICE="${VAULT_SERVICE:-truthlens}"
KNOWN_NAMES=(GROQ_API_KEY ANTHROPIC_API_KEY DATABASE_AUTH_TOKEN)

cmd="${1:-}"

if ! command -v security >/dev/null 2>&1; then
  # Not macOS: 'run' still works (keys come from .env.local / the environment).
  if [ "$cmd" = "run" ]; then shift; exec "$@"; fi
  echo "This vault uses the macOS Keychain ('security' command), which isn't available here." >&2
  exit 1
fi

name="${2:-GROQ_API_KEY}"

case "$cmd" in
  set)
    echo "Paste your $name and press Enter (input is hidden), then paste it again to confirm."
    # -w as the last argument makes 'security' prompt without echoing the value.
    security add-generic-password -U -a "$name" -s "$SERVICE" -l "$SERVICE $name" -w
    echo "Saved $name to your login Keychain (service \"$SERVICE\")."
    ;;
  check)
    if security find-generic-password -a "$name" -s "$SERVICE" >/dev/null 2>&1; then
      echo "$name is stored."
    else
      echo "$name is not stored. Run: scripts/vault.sh set $name"
      exit 1
    fi
    ;;
  remove)
    security delete-generic-password -a "$name" -s "$SERVICE" >/dev/null
    echo "Removed $name from the Keychain."
    ;;
  run)
    shift
    [ $# -gt 0 ] || { echo "Usage: scripts/vault.sh run <command...>" >&2; exit 1; }
    for var in "${KNOWN_NAMES[@]}"; do
      if value="$(security find-generic-password -a "$var" -s "$SERVICE" -w 2>/dev/null)"; then
        export "$var=$value"
      fi
    done
    exec "$@"
    ;;
  *)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
