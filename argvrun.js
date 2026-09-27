// argvrun.js：按处理预算处理并留账
import { foldToken, plainValue } from "./argv.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const source = state || {};
  return {
    values: (source.values || []).map(function (pair) { return [pair[0], pair[1]]; }),
    rest: (source.rest || []).slice(),
    pending: source.pending || "",
    literal: Boolean(source.literal),
    ledger: (source.ledger || []).map(function (entry) { return [entry[0], entry[1]]; }),
    applied: (source.applied || []).slice()
  };
}

function validEvent(event) {
  return Boolean(event) && typeof event === "object"
    && event.kind === "arg" && typeof event.text === "string"
    && event.id !== undefined;
}

function applyToken(state, text, options, optionCode) {
  try {
    if (state.literal) return plainValue(state, text);
    if (text.length > 1 && text[0] === "-") return foldToken(state, text, options);
    return plainValue(state, text);
  } catch (error) {
    if (error && error.code === "E_UNKNOWN_OPTION") error.code = optionCode;
    throw error;
  }
}

// 按预算处理：先还旧账，再逐条处理新事件；预算用尽的事件连着载压账。
export function step(spec) {
  const options = spec.options || {};
  const optionCode = spec.option_error_code || "E_UNKNOWN_OPTION";
  const eventCode = spec.event_error_code || "E_BAD_EVENT";
  const events = spec.events || [];
  for (const event of events) {
    if (!validEvent(event)) fail(eventCode, "事件结构不合法");
  }
  const state = cloneState(spec.state);
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  const bound = events.length + state.ledger.length;
  let served = 0;
  let judged = 0;
  while (state.ledger.length && budget > 0) {
    const entry = state.ledger.shift();
    applyToken(state, entry[1], options, optionCode);
    budget -= 1;
    served += 1;
    judged += 1;
  }
  for (const event of events) {
    if (state.applied.indexOf(event.id) !== -1) continue;
    if (budget > 0) {
      applyToken(state, event.text, options, optionCode);
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push([event.kind, event.text]);
    }
    judged += 1;
    state.applied.push(event.id);
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (entry) { return [entry[0], entry[1]]; }),
    judged: judged,
    judged_bound: bound
  };
}

// 收尾：不限预算把账处理完；还挂着等值的选项报 E_MISSING_VALUE。
export function close(spec) {
  const options = spec.options || {};
  const optionCode = spec.option_error_code || "E_UNKNOWN_OPTION";
  const valueCode = spec.value_error_code || "E_MISSING_VALUE";
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length) {
    const entry = state.ledger.shift();
    applyToken(state, entry[1], options, optionCode);
    catchup += 1;
  }
  if (state.pending) fail(valueCode, "选项 -" + state.pending + " 还挂着等值");
  return { state: state, catchup: catchup };
}
