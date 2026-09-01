# Kontrakt mezi LuDone Desktopem a app.ludone.cz

**Tohle je jediný platný popis.** Vzniká 1. 9. 2026 jako **most k příštímu běhu**: desktop se
dotahuje teď, serverová strana dostane vlastní průchod masterplánem v repozitáři `ludone-app`
(rozhodnutí S1). Až ten běh začne, tenhle dokument je jeho vstup.

🔴 **Ruší tři dosavadní popisy, které si navzájem odporovaly.** Viz §7.

---

## 1. Co server dostane a k čemu

Desktopová aplikace nahrává schůzku **dvěma oddělenými stopami** — mikrofon (uživatel) a systémový
zvuk (druhá strana hovoru). Obě se ukládají lokálně a odesílají po částech. Server je přijme,
uloží a později nechá přepsat.

**Vykázaný čas přes tenhle kontrakt neteče.** Rozhodnutí N1 zní „zatím nikam, později přes
`app.ludone.cz`", takže časová agenda má v desktopu adaptér a serverovou cestu dostane samostatně.

## 2. Pojmy — a proč na nich záleží

| Pojem | Znamená |
|---|---|
| **recording** | Jedna nahrávka **jedné schůzky**. Obsahuje dvě stopy |
| **track** | Jedna **stopa** téže nahrávky: `microphone` nebo `system` |
| **clientRecordingId** | UUID, které vyrábí **klient** při startu nahrávání |

🔴 **Slovo `recording` znamenalo v dosavadních popisech dvě různé věci** — jednou schůzku, jednou
stopu. Tady znamená **schůzku**. Kdo to splete, postaví datový model, který se s druhou stranou
nepotká.

## 3. Endpointy

### Založení nahrávky

```
POST /api/desktop/recordings
{
  "clientRecordingId": "<uuid vyrobené klientem při startu>",
  "startedAt":  "<ISO 8601 UTC>",
  "endedAt":    "<ISO 8601 UTC>",
  "label":      "<název zadaný uživatelem při zastavení>",
  "projectId":  "<GUID projektu z LuTracku, nebo null>",
  "tracks": [
    { "kind": "microphone", "bytes": 0, "sha256": "<hex>" },
    { "kind": "system",     "bytes": 0, "sha256": "<hex>" }
  ]
}
```

🔴 **`clientRecordingId` je idempotenční klíč.** Server na něm vynucuje unikát v rámci uživatele.
Opakované volání s týmž klíčem **nesmí založit druhý záznam** — vrátí ten existující.
Bez toho vznikne po síťovém timeoutu duplikát a nikdo si ho nevšimne.

⚠️ **`projectId` je GUID, nikdy název.** Přejmenování sedmi firem 23. 7. 2026 srazilo platby na
pět dní, protože dotaz na neexistující název vrací prázdno.

### Odeslání částí stopy

```
PUT /api/desktop/recordings/{id}/tracks/{kind}
Content-Range: bytes <od>-<do>/<celkem>
Content-Type: application/octet-stream
```

Části jdou **po pořádku** a server je skládá. Opakované odeslání téhož rozsahu je **idempotentní**.

### Uzavření

```
POST /api/desktop/recordings/{id}/complete
```

Server ověří, že součet přijatých bajtů i `sha256` každé stopy **sedí na to, co klient ohlásil
při založení**. Nesedí-li, vrátí chybu a nahrávku neuzavře.

## 4. Stavy

```
draft ──▶ uploading ──▶ accepted ──▶ transcribing ──▶ done
             │              │
             └──▶ failed ◀──┘
```

`failed` **nese důvod**. Záznam v `transcribing` nesmí zůstat navždy — po vypršení lhůty se
překlopí do `failed` s důvodem, ne se tiše zasekne.

## 5. Chyby a jak na ně klient reaguje

| Kód | Význam | Klient |
|---|---|---|
| `401` | Token vypršel | Obnoví token, **nespotřebuje pokus** |
| `403 company_out_of_scope` | Nemá právo | **Trvalá chyba** — neopakovat, data zachovat, říct důvod |
| `403 access_revoked` | Odebrán z firmy | Přestane odesílat i nabízet, **lokální soubory nemaže** |
| `409` | Idempotenční klíč už existuje | Není chyba — pokračuje s vráceným záznamem |
| `413` | Část moc velká | Zmenší část a zkusí znovu |
| `5xx` | Chyba serveru | Opakuje s odstupem: 30 s základ, strop 6 h, 5 pokusů, rozptyl 20 % |

🔴 **Trvalá chyba se nesmí opakovat pětkrát a skončit jako „failed" bez důvodu.** To je dnešní
chování fronty a je to vada.

## 6. Práva a citlivá data

- **Default-deny** na třech osách: modul-gate × company-scope × citlivá pole.
- v1: uživatel vidí **jen své vlastní** nahrávky. **Admin vidí vše** — nahrávky jsou majetkem firmy.
- Odebraný z firmy: **server data zachová** a odepře přístup.
- 🔴 **Dnešní desktopový token má scope `mcp:read` a `mcp:draft`** (`electron/auth.cjs:14`),
  tedy **nemůže zapisovat**. Server musí vydat **zápisový scope** — bez něj tenhle kontrakt
  nejde použít vůbec.
- **Doporučeno statická registrace klienta**, ne dynamická: jediná varianta, kde jde přístup
  odvolat jedním UPDATE. Dnešní kód dělá dynamickou a vynucuje ji i brána `E7.sh:49` — obojí
  se musí srovnat.

### Co musí server umět kvůli MCP

MCP nástroje staví aplikace, ne desktop (S2). Ale aby to šlo, musí uložená data nést
**vlastníka, projekt jako GUID a časy v UTC**. To je požadavek na tvar dat, ne na desktop.

## 7. Co tenhle dokument ruší

| Ruší se | Proč |
|---|---|
| `POST /api/nahravky/uploads` s číslovanými částmi (`specs/E5-server-prijem.md`) | Hotová fronta v `src/lib/queue.js:98-109` stojí na `/api/desktop/recordings`; druhá varianta by znamenala přepsat frontu i její testy |
| `track IN ('mic','system')` | Sjednoceno na `microphone` / `system` |
| Klíč `${sessionId}:${track}` | Nahrazen `clientRecordingId` na úrovni **nahrávky**, ne stopy |
| `recordings` ve významu „jedna stopa" | Znamená **schůzku** |

⚠️ Obě varianty byly uzemněné v reálném kódu `ludone-app`, takže **sloučit nešly** — jedna musela
umřít. Volba padla na tu, za kterou stojí hotový kód.

## 8. Co na straně serveru neexistuje

Změřeno 1. 9. 2026: v `ludone-app` **není routa, migrace ani větev**.
`ls src/app/api/desktop` neexistuje, `grep -rn "desktop:upload|nahravky" src/ sql/` vrací nulu,
53 větví bez shody. Navíc **`ffmpeg` chybí v Dockerfile:33** a migrace 200/201 z původní specifikace
jsou už obsazené — poslední je 251.

**Tenhle kontrakt je tedy zadání, ne popis stavu.**
