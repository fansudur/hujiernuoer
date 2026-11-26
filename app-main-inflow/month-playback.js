import { nextTimelineDate } from "./timeline-sync.js";

/* Publish one complete, correctly dated month at a time. Never relabel an old map. */
function wait(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(false); return; }
    const onAbort = () => finish(false);
    const id = setTimeout(() => finish(true), Math.max(0, ms));
    function finish(tick) {
      clearTimeout(id);
      signal.removeEventListener('abort', onAbort);
      resolve(tick);
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createMonthPlayback({
  dates, currentDate, runKey = () => null, prepare, commit, onStatus, onError, periodMs = 850,
}) {
  let active = null;
  let preparingDate = null;

  function stop() {
    if (!active) return;
    const { controller } = active;
    active = null;
    preparingDate = null;
    controller.abort();
    onStatus?.(false, null);
  }

  async function play(run) {
    const { signal } = run.controller;
    try {
      while (active === run && !signal.aborted) {
        const all = run.dates;
        if (!all.length) { stop(); return; }
        const previous = currentDate();
        const next = nextTimelineDate(all, previous);
        if (!next || next === previous || runKey() !== run.key) { stop(); return; }
        preparingDate = next;
        onStatus?.(true, next);
        const [frame, tick] = await Promise.all([
          prepare(next, signal),
          wait(periodMs, signal),
        ]);
        if (!tick || active !== run || signal.aborted) return;
        if (currentDate() !== previous || runKey() !== run.key) { stop(); return; }
        if (!frame || frame.date !== next || frame.loading ||
            !frame.lakes || Object.values(frame.lakes).some(lake => !lake || lake.loading || lake.aborted)) {
          throw new Error('月度影像数据尚未完整返回');
        }
        commit(next, frame);
        if (frame.errors?.length) { stop(); return; }
      }
    } catch (err) {
      if (active !== run || signal.aborted) return;
      const failed = preparingDate;
      stop();
      onError?.(err, failed);
    }
  }

  return {
    start() {
      if (active) return;
      const run = { controller: new AbortController(), dates: [...dates()].sort(), key: runKey() };
      active = run;
      void play(run);
    },
    stop,
    get running() { return Boolean(active); },
    get preparingDate() { return preparingDate; },
  };
}
