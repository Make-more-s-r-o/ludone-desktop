/* Galerie využívá stejné definice jako F; data a klikání jsou pouze ukázka. */
const cases=[
 ['idle','Připraveno','ready','Jen značka. Klik otevře malý panel pro nahrávání.'],
 ['recording','Nahrávání','recording','Plná tečka a běžící čas. Zavření panelu nahrávání nepřeruší.'],
 ['saving','Ukládání','saving','Šipka dolů a krátký text. Soubor se ještě dokončuje.'],
 ['decision','Po schůzce','save','Dokument a „Uložit“. Název, firma a přístup čekají v panelu.'],
 ['queue-waiting','Odesílání čeká','queue','Dvě tečky. Počet a průběh uvidíte až v panelu.'],
 ['offline','Bez připojení','offline','Přeškrtnutý kruh vedle značky. Odesílání počká; nahrávat lze dál.'],
 ['signed-out','Přihlášení','expired','Malý účet. Přihlášení nebrání místnímu nahrávání.'],
 ['recording-audio-lost','Výpadek zvuku','system-lost','Výstražný trojúhelník a čas. Panel nabídne řešení výpadku.'],
 ['recording-microphone-only','Jen mikrofon','microphone-only','Poloviční kruh a čas. Výslovně zvolený režim, nikoli skrytá chyba.'],
 ['attention','Potřebuje zásah','unclaimed','Vykřičník. Například potvrzení vlastníka nebo chyba odeslání.']
];
const T=globalThis.LuDoneFTray;
const textFor=name=>name.startsWith('recording')?'24:18':name==='saving'?'Ukládá se':name==='decision'?'Uložit':'';
const trigger=name=>`${T.svg(name)}${textFor(name)?`<span class="tray-text">${textFor(name)}</span>`:''}`;
function url(scenario){return `viewer.html?variant=f&scenario=${scenario}&preview=tray-20261005`;}
function bar(name,theme){return `<div class="menu-strip ${theme}"><span class="menu-left">${theme==='dark'?'Tmavá lišta':'Světlá lišta'}</span><div class="menu-right"><a class="tray-control" href="${url(cases.find(c=>c[0]===name)[2])}" aria-label="LuDone · ${T.names[name]}" title="LuDone · ${T.names[name]}">${trigger(name)}</a><span class="system-clock">10:32</span></div></div>`;}
globalThis.document.querySelector('#states').innerHTML=cases.map(([name,label,scenario,note])=>`<article class="state-card" data-state="${name}"><header><h3>${label}</h3><span>18 × 18 px</span></header>${bar(name,'light')}${bar(name,'dark')}<div class="asset-samples"><figure><img src="f-tray-assets/${name}.png" alt="${label}, alfa maska v 18 px"><figcaption>1×</figcaption></figure><figure><img src="f-tray-assets/${name}@2x.png" alt="${label}, Retina alfa maska"><figcaption>Retina 2×</figcaption></figure><figure><img class="zoom" src="f-tray-assets/${name}@2x.png" alt=""><figcaption>Detail 3×</figcaption></figure></div><p>${note}</p><a class="state-link" href="${url(scenario)}">Proklikat situaci ↗</a></article>`).join('');
const stateSelect=globalThis.document.querySelector('#state'), appearance=globalThis.document.querySelector('#appearance'), button=globalThis.document.querySelector('#demo-trigger'), panel=globalThis.document.querySelector('#panel');
stateSelect.innerHTML=cases.map(([name,label])=>`<option value="${name}">${label}</option>`).join('');
function show(){
 const [name,,scenario,note]=cases.find(c=>c[0]===stateSelect.value);
 globalThis.document.querySelector('#demo-bar').className=`menu-strip ${appearance.value}`;
 button.innerHTML=trigger(name);button.setAttribute('aria-label',`LuDone · ${T.names[name]} · otevřít panel`);button.title=button.getAttribute('aria-label');button.setAttribute('aria-expanded','false');
 globalThis.document.querySelector('#demo-caption').textContent=note;
 globalThis.document.querySelector('#open-scenario').href=url(scenario);
 panel.hidden=true;panel.removeAttribute('src');
}
button.addEventListener('click',()=>{
 panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));
 if(!panel.hidden){const [, ,scenario]=cases.find(c=>c[0]===stateSelect.value);panel.src=`app.html?variant=f&scenario=${scenario}&theme=${appearance.value}&embedded=1&revision=tray-20261005`;}
});
stateSelect.addEventListener('change',show);appearance.addEventListener('change',show);show();
