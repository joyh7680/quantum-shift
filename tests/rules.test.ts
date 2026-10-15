import test from "node:test";
import assert from "node:assert/strict";
import {
  checkOrder,
  compileRequest,
  suitDecision,
  testSuit,
} from "../src/rules.ts";
test("power accepts only the exact connected sequence", () => {
  assert.equal(checkOrder(["메인 전원", "A", "B", "C"]), true);
  assert.equal(checkOrder(["A", "메인 전원", "B", "C"]), false);
  assert.equal(checkOrder(["메인 전원", "A", "B"]), false);
  assert.equal(checkOrder(["메인 전원", "A", "B", "C", "C"]), false);
});
test("natural-language simulation rejects unsupported and incomplete abilities", () => {
  for (const input of [
    "무적이 되어줘",
    "레이저를 파괴하고 작아졌다 복귀해줘",
    "점프를 높게 해줘",
    "작아져",
    "레이저가 오면 작아져",
    "레이저가 오면 작아지지 않고 복귀해",
  ])
    assert.ok(compileRequest(input).error, input);
  const { program } = compileRequest(
    "레이저가 접근하면 작아지고 지나가면 이전 크기로 복귀해줘",
  );
  assert.ok(program);
  assert.deepEqual(testSuit(program), [true, true, true]);
});
test("restoration preserves the actual previous size and waits when obstructed", () => {
  const { program } = compileRequest(
    "레이저 감지 시 초소형, 이후 원래 크기로 복귀",
  );
  assert.ok(program);
  for (const previous of [0.25, 1, 2.5] as const) {
    assert.equal(
      suitDecision(program, true, previous, previous, true).size,
      0.25,
    );
    assert.deepEqual(suitDecision(program, false, 0.25, previous, false), {
      size: 0.25,
      waiting: true,
    });
    assert.equal(
      suitDecision(program, false, 0.25, previous, true).size,
      previous,
    );
  }
});
