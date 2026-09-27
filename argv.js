// argv.js：参数记号的解析
function unknownOption(ch) {
  const error = new Error("未知选项 -" + ch);
  error.code = "E_UNKNOWN_OPTION";
  return error;
}

// 短横线开头的记号：逐字符拆；"--" 之后全算位置参数；
// 开关记 on，带值类吃余下字符，没有余下字符就挂起等下一个参数。
export function foldToken(state, text, options) {
  if (text === "--") {
    state.literal = true;
    return state;
  }
  const chars = text.slice(1).split("");
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const kind = options[ch];
    if (kind !== "flag" && kind !== "value") throw unknownOption(ch);
    if (kind === "flag") {
      state.values.push([ch, "on"]);
    } else {
      const rest = chars.slice(i + 1).join("");
      if (rest) state.values.push([ch, rest]);
      else state.pending = ch;
      return state;
    }
  }
  return state;
}

// 不带短横线的记号：有挂起就喂值，否则算位置参数。
export function plainValue(state, text) {
  if (state.pending) {
    state.values.push([state.pending, text]);
    state.pending = "";
  } else {
    state.rest.push(text);
  }
  return state;
}
