#!/bin/bash
W=/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/zvuk
cd "$W" || exit 1
export GIT_PAGER=cat PAGER=cat
export CODEX_HOME="/Users/dan/Library/Application Support/orca/codex-accounts/cce8a49c-1e6f-434a-851f-c4e95cf7ce9e/home"
codex exec -s workspace-write -c 'sandbox_workspace_write.network_access=true' --json \
  --output-schema "/Users/dan/Dev/ClaudeCode/ludone-desktop/schema-zvuk.json" -o "/Users/dan/Dev/ClaudeCode/ludone-desktop/odpoved-zvuk.json" \
  'Zadani mas v souboru /Users/dan/Dev/ClaudeCode/ludone-desktop/zadani-zvuk.md — precti si ho CELE a proved presne podle nej. Na zacatku over pwd; cesty jsou absolutni schvalne. Dodrz sekci POSTUP: nejdriv napis kod na disk, pak to SPUST a opravdu vyzkousej, pak zapis nalez, pak commitni, teprve pak odpovez. Zadny prikaz nesmi cekat na vstup.' \
  < /dev/null > "/Users/dan/Dev/ClaudeCode/ludone-desktop/log-zvuk.log" 2>&1
echo "EXIT=$?" >> "/Users/dan/Dev/ClaudeCode/ludone-desktop/log-zvuk.log"
