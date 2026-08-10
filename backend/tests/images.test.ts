import { describe, it, expect } from "vitest";

import {
  extensionFor,
  isAllowedImageType,
  sniffImageType,
} from "../src/images.js";

describe("what counts as a picture we store", () => {
  it("accepts the raster types and their extensions", () => {
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(extensionFor("image/png")).toBe(".png");
    expect(extensionFor("image/jpeg")).toBe(".jpg");
  });

  it("turns away SVG, which can carry script", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
  });
});

describe("reading a picture's real type from its first bytes", () => {
  const cases: [string, Buffer][] = [
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])],
    [
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
    ],
    ["image/gif", Buffer.from("GIF89a............", "latin1")],
    ["image/webp", Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")],
  ];

  for (const [type, bytes] of cases) {
    it(`knows ${type}`, () => {
      expect(sniffImageType(bytes)).toBe(type);
    });
  }

  it("sees through an SVG, whatever it is named", () => {
    const svg = Buffer.from("<svg><script>alert(1)</script></svg>");
    expect(sniffImageType(svg)).toBeNull();
  });

  it("returns nothing for a file too short to tell", () => {
    expect(sniffImageType(Buffer.from([0xff]))).toBeNull();
  });
});
