// argv.js：参数记号的解析（短选项按字符拆，开关记 on，带值类吃余串或挂起）
function copy(state) {
  return {
    values: state.values.map(function (pair) { return [pair[0], pair[1]]; }),
    rest: state.rest.slice(),
    pending: state.pending,
    literal: state.literal
  };
}

function putValue(state, name, value) {
  for (let i = 0; i < state.values.length; i += 1) {
    if (state.values[i][0] === name) {
      state.values[i][1] = value;
      return;
    }
  }
  state.values.push([name, value]);
}

// 以短横线开头的记号：-- 进入字面量，其余逐字符查选项表
export function foldToken(state, text, options) {
  const next = copy(state);
  if (text === "--") {
    next.literal = true;
    return next;
  }
  const body = text.slice(1);
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    const known = Object.prototype.hasOwnProperty.call(options || {}, ch);
    const kind = known ? options[ch] : undefined;
    if (kind === "flag") {
      putValue(next, ch, "on");
    } else if (kind === "value") {
      const tail = body.slice(i + 1);
      if (tail.length > 0) {
        putValue(next, ch, tail);
      } else {
        next.pending = ch;
      }
      return next;
    } else {
      const error = new Error("未知选项 -" + ch);
      error.code = "E_UNKNOWN_OPTION";
      error.option = ch;
      throw error;
    }
  }
  return next;
}

// 不带短横线的记号：挂着待值就喂值，否则算位置参数
export function plainValue(state, text) {
  const next = copy(state);
  if (next.pending) {
    putValue(next, next.pending, text);
    next.pending = "";
  } else {
    next.rest.push(text);
  }
  return next;
}
