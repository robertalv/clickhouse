import "./styles.css";

type DemoEvent = {
  id: number;
  event: string;
  workspaceId: string;
  createdAt: number;
};

const state = {
  nextId: 1,
  pending: [] as DemoEvent[],
  flushed: 0,
  failed: 0,
  log: [] as string[],
};

const form = document.querySelector<HTMLFormElement>("#eventForm")!;
const eventName = document.querySelector<HTMLSelectElement>("#eventName")!;
const workspaceId = document.querySelector<HTMLInputElement>("#workspaceId")!;
const flushButton = document.querySelector<HTMLButtonElement>("#flushButton")!;
const resetButton = document.querySelector<HTMLButtonElement>("#resetButton")!;
const pendingCount = document.querySelector("#pendingCount")!;
const flushedCount = document.querySelector("#flushedCount")!;
const failedCount = document.querySelector("#failedCount")!;
const bufferState = document.querySelector("#bufferState")!;
const activityLog = document.querySelector("#activityLog")!;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const row = {
    id: state.nextId++,
    event: eventName.value,
    workspaceId: workspaceId.value.trim() || "workspace_demo",
    createdAt: Date.now(),
  };
  state.pending.push(row);
  state.log.unshift(`Buffered ${row.event} for ${row.workspaceId}`);
  render();
});

flushButton.addEventListener("click", () => {
  if (state.pending.length === 0) {
    state.log.unshift("Nothing to flush.");
    render();
    return;
  }

  const count = state.pending.length;
  state.pending = [];
  state.flushed += count;
  state.log.unshift(`Flushed ${count} row${count === 1 ? "" : "s"} to ClickHouse.`);
  render();
});

resetButton.addEventListener("click", () => {
  state.nextId = 1;
  state.pending = [];
  state.flushed = 0;
  state.failed = 0;
  state.log = [];
  render();
});

function render() {
  pendingCount.textContent = String(state.pending.length);
  flushedCount.textContent = String(state.flushed);
  failedCount.textContent = String(state.failed);
  bufferState.textContent =
    state.pending.length > 0 ? `${state.pending.length} pending` : "buffer ready";

  activityLog.innerHTML = "";
  const entries = state.log.length > 0 ? state.log : ["No events buffered yet."];
  for (const entry of entries.slice(0, 6)) {
    const item = document.createElement("li");
    item.textContent = entry;
    activityLog.append(item);
  }
}

render();
