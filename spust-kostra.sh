#!/bin/bash
W=/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/kostra
cd "$W" || exit 1
export GIT_PAGER=cat PAGER=cat
export CODEX_HOME="$HOME/.codex"
codex exec -s workspace-write -c 'sandbox_workspace_write.network_access=true' --json \
  --output-schema "/Users/dan/Dev/ClaudeCode/ludone-desktop/schema-kostra.json" -o "/Users/dan/Dev/ClaudeCode/ludone-desktop/odpoved-kostra.json" \
  'Zadani mas v souboru /Users/dan/Dev/ClaudeCode/ludone-desktop/zadani-kostra.md — precti si ho CELE a proved presne podle nej. Na zacatku over pwd; cesty jsou absolutni schvalne. Dodrz sekci POSTUP: nejdriv napis kod na disk, pak to SPUST a opravdu vyzkousej, pak zapis nalez, pak commitni, teprve pak odpovez. Zadny prikaz nesmi cekat na vstup.' \
  < /dev/null > "/Users/dan/Dev/ClaudeCode/ludone-desktop/log-kostra.log" 2>&1
echo "EXIT=$?" >> "/Users/dan/Dev/ClaudeCode/ludone-desktop/log-kostra.log"
