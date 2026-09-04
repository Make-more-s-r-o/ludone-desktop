const LEFT_STATUS_AREA_LIMIT = 0.45;
const NOTCH_MENU_BAR_MIN_HEIGHT = 32;
const MENU_BAR_MAX_PLAUSIBLE_HEIGHT = 64;
const NOTCH_CENTER_BAND_START = 0.42;
const NOTCH_CENTER_BAND_END = 0.58;

function isFiniteRectangle(rectangle) {
  return Boolean(
    rectangle
    && Number.isFinite(rectangle.x)
    && Number.isFinite(rectangle.y)
    && Number.isFinite(rectangle.width)
    && Number.isFinite(rectangle.height)
    && rectangle.width > 0
    && rectangle.height > 0
  );
}

function containsRectangle(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function trayIsProbablyOutsideStatusArea(trayBounds, display) {
  const displayBounds = display?.bounds;
  const workArea = display?.workArea;
  if (
    !isFiniteRectangle(trayBounds)
    || !isFiniteRectangle(displayBounds)
    || !isFiniteRectangle(workArea)
    || !containsRectangle(displayBounds, workArea)
    || !containsRectangle(displayBounds, trayBounds)
  ) {
    return false;
  }

  // Tray je položka horní lišty. Obdélník zasahující hlouběji než 64 bodů do
  // displeje není věrohodné měření; naměřená notch lišta má jen 37–38 bodů.
  const trayBottom = trayBounds.y + trayBounds.height;
  if (trayBottom > displayBounds.y + MENU_BAR_MAX_PLAUSIBLE_HEIGHT) return false;

  const trayRight = trayBounds.x + trayBounds.width;
  // Počátek bere celý displej záměrně: workArea.x zahrnuje Dock vlevo a posunul
  // by pozorovanou 45% hranici doprava, tedy změnil původní pravidlo.
  const leftStatusAreaLimit = displayBounds.x
    + workArea.width * LEFT_STATUS_AREA_LIMIT;

  // Původní pravidlo zůstává samostatné: položka končící před 45 % pracovní
  // plochy odpovídá pozorovanému odsunu do levé oblasti aplikačního menu.
  if (trayRight < leftStatusAreaLimit) return true;

  // Electron 39 nemá API pro výřez, ale oba obdélníky vrací v DIP bodech.
  // Horní inset nezahrnuje spodní Dock; naměřených 37–38 bodů na notch Macu
  // odděluje práh 32 s rezervou od 24–25 bodů na displeji bez výřezu.
  const menuBarHeight = workArea.y - displayBounds.y;
  const hasNotchHeight = display.internal === true
    && menuBarHeight >= NOTCH_MENU_BAR_MIN_HEIGHT
    && menuBarHeight <= MENU_BAR_MAX_PLAUSIBLE_HEIGHT;
  if (!hasNotchHeight) return false;

  const isInsideMenuBar = trayBounds.y >= displayBounds.y
    && trayBottom <= workArea.y;
  if (!isInsideMenuBar) return false;

  // Prostředních 16 % je konzervativní pás odvozený z živého měření na displeji
  // širokém 1512 bodů: pás 635–877 pokrývá neviditelnou položku 806–842,
  // ale končí před viditelnými stavovými ikonami začínajícími kolem x=890.
  // Nabídky Finderu končily kolem x=500, tedy bezpečně vlevo od tohoto pásu.
  const centerBandLeft = displayBounds.x
    + displayBounds.width * NOTCH_CENTER_BAND_START;
  const centerBandRight = displayBounds.x
    + displayBounds.width * NOTCH_CENTER_BAND_END;
  return trayRight > centerBandLeft && trayBounds.x < centerBandRight;
}

module.exports = { trayIsProbablyOutsideStatusArea };
