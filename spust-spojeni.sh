#!/bin/bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/kostra || exit 1
export GIT_PAGER=cat PAGER=cat
export CODEX_HOME="$HOME/.codex"
codex exec -s workspace-write -c 'sandbox_workspace_write.network_access=true' --json \
  --output-schema "/Users/dan/Dev/ClaudeCode/ludone-desktop/schema-spojeni.json" -o "/Users/dan/Dev/ClaudeCode/ludone-desktop/odpoved-spojeni.json" \
  'Zadani mas v souboru /Users/dan/Dev/ClaudeCode/ludone-desktop/zadani-spojeni.md — precti si ho CELE a proved presne podle nej. Over pwd. Dodrz POSTUP: nejdriv cti podklady (hlavne ../zvuk/NALEZ-OPAKOVANI.md), pak napis kod, pak SPUST a opravdu nahraj, pak zmer ticho proti zvuku, pak zapis a commitni, teprve pak odpovez.' \
  < /dev/null > "/Users/dan/Dev/ClaudeCode/ludone-desktop/log-spojeni.log" 2>&1
echo "EXIT=$?" >> "/Users/dan/Dev/ClaudeCode/ludone-desktop/log-spojeni.log"
