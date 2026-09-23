// Vyhodnotí updates-raw.json (výstup Playwright běhu v Chromiu) a vypíše PASS/FAIL po podmínkách.
import { readFileSync } from 'node:fs';
const R = JSON.parse(readFileSync(new URL('./updates-raw.json', import.meta.url), 'utf8'));
const INST = 'Simulace: tady by se LuDone zavřelo';
const checks = [
  ['A1 LuTrack běží → Aktualizovat čeká, neinstaluje', R.A1_after_update_with_timer.includes('Počká na bezpečný okamžik') && R.A1_after_update_with_timer.includes('časovač LuTrack') && !R.A1_after_update_with_timer.includes(INST)],
  ['A2 po zastavení časovače pokračuje potvrzená aktualizace', R.A2_after_timer_stop.includes(INST)],
  ['B0 během nahrávání chybí přepínač simulace (nejde přeskočit uložení)', R.B0_sim_switch_count_while_recording === 0],
  ['B1 nahrávání + časovač → čeká na obojí', R.B1_waiting.includes('nahrávání') && R.B1_waiting.includes('časovač') && !R.B1_waiting.includes(INST)],
  ['B2 během ukládání se neinstaluje', !R.B2_during_save.includes(INST) && R.B2_during_save.includes('ukládání') && R.B2_save_button.includes('Ukládám')],
  ['B3 po uložení, časovač stále běží → pořád čeká', !R.B3_after_save_timer_running.includes(INST) && R.B3_after_save_timer_running.includes('časovač')],
  ['B4 po zastavení časovače pokračuje', R.B4_after_timer_stop.includes(INST)],
  ['C0/C1 bez běžící činnosti instalace až po kliku', !R.C0_before_click.includes(INST) && R.C1_after_click.includes(INST)],
  ['D1 Pokročilé → Zkontrolovat nabízí „Zobrazit nabídku“', R.D1_offer_button.includes('Zobrazit nabídku')],
  ['D2 nabídka v panelu, neinstaluje se, fokus na Aktualizovat', R.D2_scenario === 'update' && R.D2_offer.includes('0.1.5') && !R.D2_offer.includes(INST) && R.D2_focus === 'upd-go'],
  ['D3 Později ponechá připomínku v patičce', R.D3_after_later_footer.includes('0.1.5')],
  ['žádná chyba stránky', Array.isArray(R.errors) && R.errors.length === 0],
];
let fail = 0;
for (const [n, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) fail++; }
console.log(`${checks.length - fail}/${checks.length} PASS`);
process.exit(fail ? 1 : 0);
