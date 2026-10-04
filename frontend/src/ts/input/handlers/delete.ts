import * as TestUI from "../../test/test-ui";
import * as TestWords from "../../test/test-words";
import {
  getInputElement,
  getInputElementValue,
  setInputElementValue,
} from "../input-element";

import { Config } from "../../config/store";
import { goToPreviousWord } from "../helpers/word-navigation";
import { DeleteInputType } from "../helpers/input-type";
import { getCurrentInput, logTestEvent } from "../../test/events/data";
import { getActiveWordIndex } from "../../states/test";
import { onBeforeDelete } from "./before-delete";

export function onDelete(inputType: DeleteInputType, now: number): void {
  const { realInputValue } = getInputElementValue();

  const inputBeforeDelete = getCurrentInput();
  const activeWordIndexBeforeDelete = getActiveWordIndex();

  const inputAfterDelete = getInputElementValue().inputValue;

  const beforeDeleteOnlyTabs = /^\t*$/.test(inputBeforeDelete);
  const allTabsCorrect = TestWords.words
    .getCurrent()
    ?.textWithCommit.startsWith(inputAfterDelete);

  //special check for code languages
  if (
    Config.language.startsWith("code") &&
    Config.codeUnindentOnBackspace &&
    inputBeforeDelete.length > 0 &&
    beforeDeleteOnlyTabs &&
    allTabsCorrect
  ) {
    // Clear N+1's tabs (the word the user was in)
    logTestEvent("input", now, {
      inputType: "deleteWordBackward",
      wordIndex: activeWordIndexBeforeDelete,
      charIndex: inputBeforeDelete.length,
      inputValue: "",
    });

    setInputElementValue("");
    goToPreviousWord(inputType);

    // Record the resulting state of the previous word (newline removed)
    const postNavInputValue = getInputElementValue().inputValue;
    logTestEvent("input", now, {
      inputType: "deleteContentBackward",
      wordIndex: getActiveWordIndex(),
      charIndex: postNavInputValue.length,
      inputValue: postNavInputValue,
    });

    TestUI.afterTestDelete();
    return;
  }

  //normal backspace
  if (realInputValue === "") {
    // if the input is NOT empty, that means the ctrl backspace deleted more than just the fake space (THANKS FIREFOX)
    // which means we need to force update the current word element when we move back
    goToPreviousWord(inputType);

    // Record the resulting state of the destination word
    const postNavInputValue = getInputElementValue().inputValue;
    logTestEvent("input", now, {
      inputType: inputType,
      wordIndex: getActiveWordIndex(),
      charIndex: postNavInputValue.length,
      inputValue: postNavInputValue,
      ...(inputBeforeDelete !== "" ? { clearedNextWord: true } : {}),
    });
  } else {
    // Delete within current word
    logTestEvent("input", now, {
      inputType: inputType,
      wordIndex: activeWordIndexBeforeDelete,
      charIndex: inputBeforeDelete.length,
      inputValue: inputAfterDelete,
    });
  }

  TestUI.afterTestDelete();
}

/**
 * Performs a delete as if the browser had done it, for deletes triggered by
 * monkeytype itself (e.g. vim mode commands). Goes through the same
 * beforeinput checks as a real delete, so confidence mode etc. still apply.
 * Returns false if the delete was blocked.
 */
export function emulateDelete(
  inputType: DeleteInputType,
  now: number,
): boolean {
  const beforeInputEvent = new InputEvent("beforeinput", {
    inputType,
    cancelable: true,
  });
  onBeforeDelete(beforeInputEvent);
  if (beforeInputEvent.defaultPrevented) return false;

  const { inputValue } = getInputElementValue();
  if (inputValue === "") {
    // deleting the fake space moves back to the previous word
    getInputElement().value = "";
  } else if (inputType === "deleteWordBackward") {
    setInputElementValue("");
  } else {
    setInputElementValue(inputValue.slice(0, -1));
  }

  onDelete(inputType, now);
  return true;
}
