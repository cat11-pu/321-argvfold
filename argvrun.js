// argvrun.js：按处理预算处理事件，用尽后未处理的连体裁压账，下一轮先还账
import { foldToken, plainValue } from "./argv.js";

function cloneState(state) {
  return {
    values: (state.values || []).map(function (pair) { return [pair[0], pair[1]]; }),
    rest: (state.rest || []).slice(),
    pending: state.pending || "",
    literal: Boolean(state.literal),
    ledger: (state.ledger || []).map(function (row) { return [row[0], row[1]]; }),
    applied: (state.applied || []).slice()
  };
}

function mark(applied, event) {
  const sig = event && event.id !== undefined && event.id !== null
    ? "id:" + String(event.id)
    : "arg:" + String(event.kind) + ":" + String(event.text);
  if (applied.indexOf(sig) === -1) {
    applied.push(sig);
  }
}

function marked(applied, event) {
  const sig = event && event.id !== undefined && event.id !== null
    ? "id:" + String(event.id)
    : "arg:" + String(event.kind) + ":" + String(event.text);
  return applied.indexOf(sig) !== -1;
}

function validateEvents(events) {
  if (!Array.isArray(events)) {
    const error = new Error("事件列表不合法");
    error.code = "E_BAD_EVENT";
    throw error;
  }
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event || typeof event !== "object"
      || event.kind !== "arg"
      || typeof event.text !== "string") {
      const error = new Error("第 " + (i + 1) + " 条事件结构不合法");
      error.code = "E_BAD_EVENT";
      error.index = i;
      throw error;
    }
  }
}

function rethrow(error, spec) {
  if (error && error.code === "E_UNKNOWN_OPTION" && spec.option_error_code) {
    error.code = spec.option_error_code;
  }
  if (error && error.code === "E_MISSING_VALUE" && spec.value_error_code) {
    error.code = spec.value_error_code;
  }
  if (error && error.code === "E_BAD_EVENT" && spec.event_error_code) {
    error.code = spec.event_error_code;
  }
  throw error;
}

function dispatch(working, text, options) {
  let result;
  if (working.literal || !text.startsWith("-") || text === "-") {
    result = plainValue(working, text);
  } else if (text === "--") {
    result = foldToken(working, text, options);
  } else {
    result = foldToken(working, text, options);
  }
  working.values = result.values;
  working.rest = result.rest;
  working.pending = result.pending;
  working.literal = result.literal;
}

export function step(spec) {
  const events = spec.events || [];
  try {
    validateEvents(events);
  } catch (error) {
    rethrow(error, spec);
  }
  const options = spec.options || {};
  const working = cloneState(spec.state || {});
  const bound = events.length;
  const budget = spec.budget === undefined ? bound : spec.budget;

  let served = 0;

  // 上一轮压在账上的请求先偿还，偿还一条花一次预算
  while (working.ledger.length > 0 && served < budget) {
    const row = working.ledger.shift();
    try {
      dispatch(working, row[1], options);
    } catch (error) {
      rethrow(error, spec);
    }
    served += 1;
  }

  // 再按顺序处理本轮事件；重放遇到已处理过的记号直接跳过、不花预算
  for (let i = 0; i < events.length && served < budget; i += 1) {
    const event = events[i];
    if (marked(working.applied, event)) {
      continue;
    }
    try {
      dispatch(working, event.text, options);
    } catch (error) {
      rethrow(error, spec);
    }
    mark(working.applied, event);
    served += 1;
  }

  // 预算用尽后，没处理上的事件连体裁压账，带到下一轮
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!marked(working.applied, event)) {
      working.ledger.push(["arg", event.text]);
      mark(working.applied, event);
    }
  }

  return {
    state: working,
    served,
    ledger_before: working.ledger.length,
    ledger: working.ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: served,
    judged_bound: bound
  };
}

export function close(spec) {
  const working = cloneState(spec.state || {});
  const options = spec.options || {};
  let catchup = 0;

  // 收尾不限预算，把账上的请求全部处理完
  while (working.ledger.length > 0) {
    const row = working.ledger.shift();
    try {
      dispatch(working, row[1], options);
    } catch (error) {
      rethrow(error, spec);
    }
    catchup += 1;
  }

  if (working.pending) {
    const error = new Error("选项 -" + working.pending + " 还缺一个值");
    error.code = spec.value_error_code || "E_MISSING_VALUE";
    error.option = working.pending;
    throw error;
  }

  return { state: working, catchup };
}
