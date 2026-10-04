import { Config } from "../../config/store";
import { configEvent } from "../../events/config";
import * as Caret from "../../test/caret";
import { isTestActive, wordsHaveTab } from "../../states/test";
import { getInputElementValue } from "../input-element";
import { getVimMode, setVimMode } from "../state";
import { emulateDelete } from "./delete";

// keys typed in normal mode that dont form a complete command yet, e.g. "2d"
let pendingKeys = "";

// text objects / motions that delete backwards from the caret.
// the caret always sits at the end of the typed input, so these all behave
// like ctrl+backspace
const WORD_TARGETS = new Set(["b", "B", "iw", "aw", "iW", "aW"]);

// incomplete commands that should wait for more keys
const PENDING_COMMANDS = new Set(["d", "c", "di", "da", "ci", "ca"]);

function setMode(mode: "insert" | "normal"): void {
  pendingKeys = "";
  if (getVimMode() === mode) return;
  setVimMode(mode);
  Caret.updateStyle();
}

export function resetVimMode(): void {
  setMode("insert");
}

function isCurrentInputEmpty(): boolean {
  return getInputElementValue().inputValue === "";
}

// x - deletes characters in the current word only, like vim stops at the
// start of the line
function deleteChars(count: number, now: number): void {
  for (let i = 0; i < count; i++) {
    if (isCurrentInputEmpty()) return;
    if (!emulateDelete("deleteContentBackward", now)) return;
  }
}

// db / diw - each repeat goes back one word, same as ctrl+backspace
function deleteWords(count: number, now: number): void {
  for (let i = 0; i < count; i++) {
    if (!emulateDelete("deleteWordBackward", now)) return;
  }
}

// dd / cc / S - clears the current word but never leaves it
function clearCurrentWord(now: number): void {
  if (isCurrentInputEmpty()) return;
  emulateDelete("deleteWordBackward", now);
}

function runNormalModeKey(key: string, now: number): void {
  pendingKeys += key;

  const match = /^([1-9]\d*)?(.*)$/.exec(pendingKeys);
  const count = match?.[1] !== undefined ? parseInt(match[1], 10) : 1;
  const command = match?.[2] ?? "";

  if (command === "" || PENDING_COMMANDS.has(command)) {
    // wait for the rest of the command
    return;
  }

  pendingKeys = "";

  if (command === "i" || command === "a" || command === "A") {
    setMode("insert");
  } else if (command === "x") {
    deleteChars(count, now);
  } else if (command === "s") {
    deleteChars(count, now);
    setMode("insert");
  } else if (command === "dd") {
    clearCurrentWord(now);
  } else if (command === "cc" || command === "S") {
    clearCurrentWord(now);
    setMode("insert");
  } else if (command.startsWith("d") && WORD_TARGETS.has(command.slice(1))) {
    deleteWords(count, now);
  } else if (command.startsWith("c") && WORD_TARGETS.has(command.slice(1))) {
    deleteWords(count, now);
    setMode("insert");
  }
  // anything else is an unknown command and is discarded
}

/**
 * Handles vim mode for a keydown on the words input.
 * Returns true if the key was consumed and should not reach the input or
 * any hotkeys.
 */
export function handleVimKeydown(event: KeyboardEvent, now: number): boolean {
  if (!Config.vimMode || event.isComposing) return false;

  if (getVimMode() === "insert") {
    if (
      event.key === "Escape" &&
      isTestActive() &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      setMode("normal");
      return true;
    }
    return false;
  }

  // the test ended while in normal mode
  if (!isTestActive()) {
    resetVimMode();
    return false;
  }

  if (event.key === "Escape") {
    if (pendingKeys !== "") {
      pendingKeys = "";
      return true;
    }
    // a second escape falls through to the regular escape hotkey
    return false;
  }

  // deleting is only allowed through vim commands in normal mode
  if (event.key === "Backspace" || event.key === "Delete") return true;

  // let hotkeys like the commandline or quick restart through
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  if (event.key === "Tab" && !wordsHaveTab()) return false;
  // bail out
  if (event.key === "Enter" && event.shiftKey) return false;

  if (event.key.length === 1) {
    runNormalModeKey(event.key, now);
  }

  // everything else is swallowed, normal mode never types
  return true;
}

configEvent.subscribe(({ key }) => {
  if (key === "vimMode" && !Config.vimMode) {
    resetVimMode();
  }
});
