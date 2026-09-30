import assert from "node:assert/strict";
import test from "node:test";
import {
  albumReleaseKey,
  preferAlbumTitle,
  sameAlbum,
} from "@/lib/entity-normalize";

test("edition and soundtrack suffixes are the same album", () => {
  assert.equal(
    sameAlbum("La La Land", "La La Land (Original Motion Picture Soundtrack)"),
    true
  );
  assert.equal(
    sameAlbum("Abbey Road", "Abbey Road (Remastered)"),
    true
  );
  assert.equal(
    sameAlbum("Mahler: Symphony No.5", "Mahler: Symphony No. 5"),
    true
  );
  assert.equal(
    sameAlbum(
      "METRO BOOMIN PRESENTS SPIDER-MAN: ACROSS THE SPIDER-VERSE",
      "METRO BOOMIN PRESENTS SPIDER-MAN: ACROSS THE SPIDER-VERSE (SOUNDTRACK FROM AND INSPIRED BY THE MOTION PICTURE)"
    ),
    true
  );
});

test("different releases stay apart", () => {
  assert.equal(sameAlbum("Backyard Boy", "Backyard Boy (Stripped)"), false);
  assert.equal(
    sameAlbum(
      "Shostakovich: Symphony No. 5",
      "Shostakovich: Symphonies Nos. 5 & 6"
    ),
    false
  );
  assert.equal(
    sameAlbum(
      "Ori and the Blind Forest (Original Soundtrack)",
      "Ori and the Blind Forest (Definitive Edition)"
    ),
    false
  );
});

test("plain title wins over the suffixed one", () => {
  assert.equal(
    preferAlbumTitle("La La Land (Original Motion Picture Soundtrack)", "La La Land"),
    "La La Land"
  );
  assert.equal(
    preferAlbumTitle("By the Way", "By the Way (Deluxe Edition)"),
    "By the Way"
  );
});

test("release keys ignore punctuation only", () => {
  assert.equal(
    albumReleaseKey("Tchaikovsky: Symphony No. 6 \"Pathétique\""),
    albumReleaseKey("Tchaikovsky: Symphony No. 6, \"Pathétique\"")
  );
});
