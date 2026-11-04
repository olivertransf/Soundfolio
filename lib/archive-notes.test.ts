import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyArchiveNotes,
  parseArchiveNotes,
  mergeEras,
} from "./archive-notes";
test("annotation format validates user writing and rejects malformed stored lists", () => {
  const notes = emptyArchiveNotes();
  assert.deepEqual(parseArchiveNotes(JSON.stringify(notes)), notes);
  assert.throws(() => parseArchiveNotes('{"version":1,"memories":false}'));
  assert.throws(() => parseArchiveNotes('{"version":2}'));
});
test("merging named eras preserves both descriptions and attached memories", () => {
  const n = emptyArchiveNotes();
  n.eras = [
    {
      id: "a",
      name: "A",
      from: "2023-01-01",
      to: "2023-03-31",
      description: "First words",
      color: "#aaa",
      cover: "",
    },
    {
      id: "b",
      name: "B",
      from: "2023-05-01",
      to: "2023-06-30",
      description: "More words",
      color: "#bbb",
      cover: "",
    },
  ];
  n.memories = [
    {
      id: "m",
      target: "era:a",
      title: "Keep",
      text: "A personal memory",
      tags: "",
      link: "",
    },
  ];
  const result = mergeEras(n, "a", "b");
  assert.equal(result.eras.length, 1);
  assert.equal(result.eras[0].from, "2023-01-01");
  assert.equal(result.eras[0].to, "2023-06-30");
  assert.equal(result.memories[0].target, "era:b");
  assert.match(result.eras[0].description, /First words/);
  assert.equal(n.eras.length, 2);
});
