import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const packagedApp = path.join(
  projectRoot,
  "release",
  "LuDone Desktop.app",
);
const appBundle = process.env.LUDONE_AUDIO_APP_BUNDLE || packagedApp;
const explicitAppPath = process.env.LUDONE_AUDIO_APP_PATH;
const directLaunch = process.env.LUDONE_AUDIO_LAUNCH_MODE !== "open";
const proofRoot = path.resolve(
  process.env.LUDONE_AUDIO_PROOF_ROOT
    || path.join(projectRoot, ".runtime", `audio-proof-${new Date().toISOString().replace(/[:.]/g, "-")}`),
);
const onboardingKey = "ludone.prototype.onboarding-complete";
const glassSound = "/System/Library/Sounds/Glass.aiff";
// Čisté tiché běhy mají stovky bajtů až přibližně 1,4 kB, doložený
// znečištěný běh měl 50 107 B. 4 KiB nechává čistému tichu téměř 3× rezervu.
const SILENCE_CONTAMINATION_MAX_BYTES = 4_096;
// Tři celkové pokusy znamenají nejvýš dvě opakování: stačí na krátké rušení,
// ale měření zůstane časově omezené a nemůže se opakovat donekonečna.
const MAX_SILENCE_ATTEMPTS = 3;

await access(appBundle);
await access(glassSound);
await mkdir(proofRoot, { recursive: true });

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(check, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timeout: ${label}${lastError ? ` (${lastError.message})` : ""}`);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
      else resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || "Chyba Runtime.evaluate");
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function cdpTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP /json/list vrátil ${response.status}`);
  return response.json();
}

async function connectPanel(port) {
  const target = await waitFor(async () => {
    const targets = await cdpTargets(port);
    return targets.find((candidate) => (
      candidate.type === "page"
      && candidate.url.startsWith("file://")
      && candidate.url.includes("/dist/index.html")
      && !candidate.url.endsWith("#settings")
    ));
  }, "CDP target hlavního panelu");
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await waitFor(
    () => client.evaluate("document.readyState === 'complete'"),
    "načtení hlavního panelu",
  );
  return client;
}

async function clickButton(client, text) {
  const point = await client.evaluate(`(() => {
    const normalize = (value) => value.replace(/\\s+/g, " ").trim();
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => normalize(candidate.textContent).includes(${JSON.stringify(text)}) && !candidate.disabled);
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`Tlačítko „${text}“ není dostupné.`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
}

async function recordingFiles(recordingsDirectory) {
  try {
    return (await readdir(recordingsDirectory))
      .filter((name) => name.endsWith(".webm"))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function runAfplay(tempDirectory, activeChildren) {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/afplay", [glassSound], {
      env: { ...process.env, TMPDIR: tempDirectory },
      stdio: ["ignore", "ignore", "pipe"],
    });
    activeChildren.add(child);
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      activeChildren.delete(child);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      activeChildren.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`afplay skončil code=${code} signal=${signal}: ${stderr.trim()}`));
    });
  });
}

function playGlassThreeTimes(tempDirectory, activeChildren) {
  return Promise.all([
    runAfplay(tempDirectory, activeChildren),
    runAfplay(tempDirectory, activeChildren),
    runAfplay(tempDirectory, activeChildren),
  ]);
}

async function exitsWithin(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    const handleExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.removeListener("exit", handleExit);
      resolve(false);
    }, timeout);
    child.once("exit", handleExit);
  });
}

async function waitForExit(child) {
  if (!child.pid || await exitsWithin(child, 15_000)) return;
  child.kill("SIGTERM");
  if (await exitsWithin(child, 3_000)) return;
  child.kill("SIGKILL");
  if (!await exitsWithin(child, 3_000)) {
    throw new Error(`Proces aplikace ${child.pid} se nepodařilo ukončit`);
  }
}

async function runRecording(mode) {
  const runRoot = path.join(proofRoot, mode);
  const tempDirectory = path.join(runRoot, "temp");
  const recordingsDirectory = path.join(runRoot, "user-data", "nahravky");
  const stdoutPath = path.join(runRoot, "application.stdout.log");
  const stderrPath = path.join(runRoot, "application.stderr.log");
  const applicationLogPath = path.join(runRoot, "application.log");
  await mkdir(tempDirectory, { recursive: true });
  const port = await freePort();
  const openArguments = [
    "-n",
    "-F",
    "-W",
    "-a",
    appBundle,
    "--env",
    `LUDONE_DATA_DIR=${runRoot}`,
    "--env",
    "LUDONE_E2E=1",
    "--env",
    "LUDONE_E2E_HARD_STOP_MS=30000",
    "--env",
    `TMPDIR=${tempDirectory}`,
    "--stdout",
    stdoutPath,
    "--stderr",
    stderrPath,
    "--args",
    ...(explicitAppPath ? [path.resolve(explicitAppPath)] : []),
    `--remote-debugging-port=${port}`,
  ];
  const directArguments = [
    ...(explicitAppPath ? [path.resolve(explicitAppPath)] : []),
    `--remote-debugging-port=${port}`,
  ];
  const child = directLaunch
    ? spawn(path.join(appBundle, "Contents", "MacOS", "Electron"), directArguments, {
      cwd: projectRoot,
      env: {
        ...process.env,
        LUDONE_DATA_DIR: runRoot,
        LUDONE_E2E: "1",
        LUDONE_E2E_HARD_STOP_MS: "30000",
        TMPDIR: tempDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    : spawn("/usr/bin/open", openArguments, {
      cwd: projectRoot,
      env: { ...process.env, TMPDIR: tempDirectory },
      stdio: ["ignore", "pipe", "pipe"],
    });
  let launcherLog = "";
  child.stdout.on("data", (chunk) => { launcherLog += chunk; });
  child.stderr.on("data", (chunk) => { launcherLog += chunk; });
  child.on("error", (error) => { launcherLog += `${error.stack || error.message}\n`; });
  let client;
  const activeAudioChildren = new Set();
  let playback = Promise.resolve({ error: null });

  async function persistApplicationLog() {
    const [stdout, stderr] = await Promise.all([
      readFile(stdoutPath, "utf8").catch(() => ""),
      readFile(stderrPath, "utf8").catch(() => ""),
    ]);
    await writeFile(
      applicationLogPath,
      [`[launcher]\n${launcherLog}`, `[stdout]\n${stdout}`, `[stderr]\n${stderr}`].join("\n"),
    );
  }

  try {
    client = await connectPanel(port);
    await client.evaluate(`(() => {
      window.localStorage.setItem(${JSON.stringify(onboardingKey)}, "true");
      return true;
    })()`);
    await client.send("Page.reload", { ignoreCache: true });
    await waitFor(
      () => client.evaluate("document.body.innerText.includes('Spustit nahrávání')"),
      "panel po přeskočení onboardingu",
    );
    const secureContext = await client.evaluate(`(() => ({
      secure: window.isSecureContext,
      mediaDevices: Boolean(navigator.mediaDevices),
      href: window.location.href,
    }))()`);
    if (!secureContext.secure || !secureContext.mediaDevices) {
      throw new Error(`Renderer není připraven pro capture: ${JSON.stringify(secureContext)}`);
    }

    const filesBefore = await recordingFiles(recordingsDirectory);
    await clickButton(client, "Spustit nahrávání");
    const labels = await waitFor(async () => {
      const state = await client.evaluate(`(() => {
        const card = document.querySelector(".recording-card");
        return {
          phase: card?.dataset.recordingPhase,
          microphone: card?.dataset.microphoneLabel,
          system: card?.dataset.systemLabel,
          text: card?.innerText,
        };
      })()`);
      if (state?.text?.includes("Nahrávání se nespustilo")) {
        throw new Error(state.text);
      }
      return state?.phase === "recording" ? state : null;
    }, `${mode}: oba MediaRecordery ve stavu recording`, 25_000);

    const actualStartedAt = Date.now();
    playback = mode === "sound"
      ? playGlassThreeTimes(tempDirectory, activeAudioChildren).then(
        () => ({ error: null }),
        (error) => ({ error }),
      )
      : Promise.resolve({ error: null });
    await delay(5_000);
    await clickButton(client, "Zastavit nahrávání");
    const actualRecordingMs = Date.now() - actualStartedAt;
    const playbackResult = await playback;
    if (playbackResult.error) throw playbackResult.error;
    await waitFor(async () => {
      const state = await client.evaluate(`(() => {
        const card = document.querySelector(".recording-card");
        return { phase: card?.dataset.recordingPhase, text: card?.innerText };
      })()`);
      if (state?.text?.includes("kvůli chybě")) throw new Error(state.text);
      return state?.phase === "idle" && state?.text?.includes("Uloženo místně") ? state : null;
    }, `${mode}: oba soubory potvrzené na disku`);

    const filesAfter = await recordingFiles(recordingsDirectory);
    const createdNames = filesAfter.filter((name) => !filesBefore.includes(name));
    if (createdNames.length !== 2) {
      throw new Error(`${mode}: očekávám dva nové WebM soubory, nalezeno ${createdNames.length}`);
    }
    if (!createdNames.some((name) => name.endsWith("-mikrofon.webm"))
      || !createdNames.some((name) => name.endsWith("-system.webm"))) {
      throw new Error(`${mode}: soubory nejsou oddělené mikrofon/system: ${createdNames.join(", ")}`);
    }

    const quit = await client.evaluate("window.ludone.testQuit()");
    if (!quit?.allowed) throw new Error("Testovací ukončení aplikace nebylo povoleno");
    client.close();
    client = undefined;
    await waitForExit(child);
    await persistApplicationLog();
    return {
      mode,
      actualRecordingMs,
      secureContext,
      labels: { microphone: labels.microphone, system: labels.system },
      files: createdNames.map((name) => path.join(recordingsDirectory, name)),
      applicationLog: applicationLogPath,
    };
  } catch (error) {
    for (const audioChild of activeAudioChildren) audioChild.kill("SIGTERM");
    await playback;
    if (client) {
      await client.evaluate("window.ludone.testQuit()").catch(() => {});
      client.close();
    }
    await waitForExit(child);
    await persistApplicationLog();
    throw new Error(`${mode}: ${error.message}\nLog aplikace: ${applicationLogPath}`, { cause: error });
  }
}

async function measureRun(run) {
  const measuredFiles = await Promise.all(run.files.map(async (filePath) => ({
    path: filePath,
    size: (await stat(filePath)).size,
  })));
  const microphone = measuredFiles.find(({ path: filePath }) => filePath.endsWith("-mikrofon.webm"));
  const system = measuredFiles.find(({ path: filePath }) => filePath.endsWith("-system.webm"));
  if (!microphone || !system || microphone.size === 0 || system.size === 0) {
    throw new Error(`${run.mode}: měření nenašlo dvě neprázdné oddělené stopy`);
  }
  return { ...run, measurements: { microphone, system } };
}

const discardedSilenceRuns = [];
let acceptedSilenceRun;

for (let attempt = 1; attempt <= MAX_SILENCE_ATTEMPTS; attempt += 1) {
  const measured = await measureRun(await runRecording(`silence-pokus-${attempt}`));
  const systemBytes = measured.measurements.system.size;
  if (systemBytes <= SILENCE_CONTAMINATION_MAX_BYTES) {
    acceptedSilenceRun = { ...measured, attempt };
    break;
  }

  discardedSilenceRuns.push({ ...measured, attempt, outcome: "measurement-contaminated" });
  console.warn(
    `Tichý běh zahozen (pokus ${attempt}/${MAX_SILENCE_ATTEMPTS}): systémová stopa má ${systemBytes} B, práh je ${SILENCE_CONTAMINATION_MAX_BYTES} B — měření bylo znečištěné cizím zvukem.`,
  );
  if (attempt < MAX_SILENCE_ATTEMPTS) await delay(1_000);
}

const proofFile = path.join(proofRoot, "proof-files.json");
if (!acceptedSilenceRun) {
  const contaminatedResult = {
    proofRoot,
    outcome: "measurement-contaminated",
    silenceContaminationMaxBytes: SILENCE_CONTAMINATION_MAX_BYTES,
    maxSilenceAttempts: MAX_SILENCE_ATTEMPTS,
    discardedSilenceRuns,
  };
  await writeFile(proofFile, `${JSON.stringify(contaminatedResult, null, 2)}\n`);
  throw new Error(
    `Měření bylo opakovaně znečištěné cizím zvukem (${MAX_SILENCE_ATTEMPTS}/${MAX_SILENCE_ATTEMPTS} pokusů); nejde o důkaz selhání aplikace.`,
  );
}

const soundRun = await measureRun(await runRecording("sound"));
const runs = [acceptedSilenceRun, soundRun];
const silenceSystemBytes = acceptedSilenceRun.measurements.system.size;
const soundSystemBytes = soundRun.measurements.system.size;
const requiredSystemBytes = Math.max(silenceSystemBytes * 3, silenceSystemBytes + 4_096);
const applicationRecorded = soundSystemBytes > requiredSystemBytes;
const result = {
  proofRoot,
  outcome: applicationRecorded ? "measurement-ok" : "application-did-not-record",
  silenceContaminationMaxBytes: SILENCE_CONTAMINATION_MAX_BYTES,
  maxSilenceAttempts: MAX_SILENCE_ATTEMPTS,
  discardedSilenceRuns,
  runs,
  comparison: {
    silenceSystemBytes,
    soundSystemBytes,
    requiredSystemBytes,
    passes: applicationRecorded,
  },
};
await writeFile(proofFile, `${JSON.stringify(result, null, 2)}\n`);
if (!applicationRecorded) {
  throw new Error(
    `Měření proběhlo bez znečištění, ale aplikace opravdu nenahrála systémový zvuk: ${soundSystemBytes} B, požadováno více než ${requiredSystemBytes} B.`,
  );
}
console.log(JSON.stringify(result, null, 2));
