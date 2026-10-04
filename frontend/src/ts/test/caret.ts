import { Config } from "../config/store";
import { getCurrentInput } from "./events/data";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getActiveWordIndex,
} from "../states/test";
import { configEvent } from "../events/config";
import { Caret } from "../elements/caret";
import * as CompositionState from "../legacy-states/composition";
import { qsr } from "../utils/dom";
import { getVimMode } from "../input/state";

export function stopAnimation(): void {
  caret.stopBlinking();
}

export function startAnimation(): void {
  caret.startBlinking();
}

export function hide(): void {
  caret.hide();
}

export function resetPosition(): void {
  caret.stopAllAnimations();
  caret.clearMargins();
  caret.goTo({
    wordIndex: 0,
    letterIndex: 0,
    isLanguageRightToLeft: isLanguageRightToLeft(),
    isDirectionReversed: isDirectionReversed(),
    animate: false,
  });
}

function isVimNormalMode(): boolean {
  return Config.vimMode && getVimMode() === "normal";
}

export function updatePosition(noAnim = false): void {
  let letterIndex =
    getCurrentInput().length + CompositionState.getData().length;
  // in vim normal mode the caret sits on the last typed letter, like in vim
  if (isVimNormalMode()) letterIndex = Math.max(0, letterIndex - 1);

  caret.goTo({
    wordIndex: getActiveWordIndex(),
    letterIndex,
    isLanguageRightToLeft: isLanguageRightToLeft(),
    isDirectionReversed: isDirectionReversed(),
    animate: Config.smoothCaret !== "off" && !noAnim,
  });
}

export const caret = new Caret(qsr("#caret"), Config.caretStyle);

// vim normal mode uses a block caret, unless the caret is turned off
export function updateStyle(): void {
  caret.setStyle(
    isVimNormalMode() && Config.caretStyle !== "off"
      ? "block"
      : Config.caretStyle,
  );
  updatePosition(true);
}

configEvent.subscribe(({ key }) => {
  if (key === "caretStyle") {
    updateStyle();
  }
  if (key === "smoothCaret") {
    caret.updateBlinkingAnimation();
  }
});

export function show(noAnim = false): void {
  caret.show();
  updatePosition(noAnim);
  startAnimation();
}
