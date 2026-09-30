# Firma a viditelnost před odesláním

**30. 9. 2026 · přímý mandát Dana:** výběr firmy působí, že se nezapamatuje;
zvolit firmu a viditelnost také pro konkrétní nahrávku před uploadem.
Jde o rozšíření stejného desktopového běhu. Backend se nemění.

## Produktový kontrakt

- Nastavení ukáže skutečně uloženou výchozí firmu po načtení platné identity.
  Načítání, neuložená změna, uložení a chyba jsou rozlišeny. Výběr nesmí působit
  jako reset při každém otevření. Default platí pro daný účet a prostředí.
- Formulář po zastavení nabídne cílovou firmu a dvě podporované možnosti:
  **Soukromá** a **Sdílená ve firmě**. Podle novějšího D11 má nová nahrávka
  výchozí Sdílená ve firmě; před uploadem lze zvolit Soukromá.
  Firma pro jednu nahrávku nemění výchozí firmu účtu.
- U místní, dosud neodesílané nahrávky lze stejné údaje nastavit v detailu před
  akcí Uložit a odeslat. Samotná změna údajů nic neodesílá.
- Jakmile existuje serverová vazba nebo jakýkoliv upload progress, firma a
  viditelnost se zamknou. Retry použije stejný záznam, ID a původní vazbu.
  Samotný lokální pin po odmítnutém INIT 403 bez serverových ID není serverová
  vazba: lze jej změnit jen výslovnou čerstvou volbou pro nahrávku. Retry jej
  nesmí přebít defaultem účtu.
- Automatické odesílání nových nahrávek používá výchozí firmu a Sdílená ve firmě.
  Změna nastavení nesmí hromadně schválit staré soubory.
- Přepis a následné změny serverového záznamu zůstávají na webu.

## Bezpečnost a autorita

Výchozí firma už je v šifrované auth relaci. Restart a refresh ji zachovají;
logout nebo změna prostředí ji záměrně smažou. Tento běh nemění hranici logoutu
a nezavádí globální poslední firmu sdílenou mezi účty. Opraví skutečný stav UI.

Firma musí pocházet z čerstvé nabídky téhož ověřeného účtu a serveru. Použít
stávající nabídku s offer tokenem a kontroly issuer/resource/scope/owner/generation.
Nový úzký per-recording IPC vyžaduje kontrolu hlavního rámce a role odesílatele.
Žádný rendererem dodaný GUID sám o sobě není oprávnění.

Per-recording preference se uloží atomicky do fronty před souhlasem s uploadem.
U změny již uložené položky platí queue/file CAS a guard identity uvnitř serializace.
Uploader použije pinned server firmu → výslovnou firmu nahrávky → default účtu →
historický manifest. Nově vytvořené položky se výslovně inicializují company; chybějící preference
u historických položek či starého API zůstává private. Historický
rozpracovaný upload se nesmí tiše změnit. Manifest nesmí být druhá rozporná autorita.

## Ověření

Regrese: otevření nastavení znovu, uložený default, neuložená změna, selhání nabídky,
restart fronty, override nad defaultem, private fallback, company visibility v
skutečném těle klientského uploadu, stale revize, změna identity/originu, cizí firma,
podvržený IPC sender a zamčené server progress. Původní kontroly zůstávají zachovány.
Síť v testech je simulovaná; reálný upload na Macu zůstává lidská přejímka.

## Pořadí

T-12 datová vrstva a zabezpečený IPC, potom T-13 UI nad hotovým kontraktem.
Koordinátor integruje postupně, zopakuje brány a rozšířený audit. Stav vydání
zůstává podmíněný přesnou designovou E2E branou obnovenou podle potvrzeného D10.

## Read-only ověření serverového kontraktu

Sousední serverový checkout LuDone/ludone-app@ca4c476cae82d5de2bf67a37b169e342f091ac29
je čistý a nebyl měněn. src/app/api/nahravky/uploads/route.ts:47 má enum private/company,
:240–242 validaci s private fallback a :407–408 zápis firmy i visibility. :462 kontroluje
shodu firmy existující idempotentní položky. To dokládá zdrojový kontrakt, nikoli
aktuální produkční nasazení nebo skutečný upload.
