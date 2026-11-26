import { describe, expect, it } from "vitest";
import { parseMapBasemap } from "../lib/map-basemap.js";

const empty = {
  tileUrl: null,
  imageUrl: null,
  south: null,
  west: null,
  north: null,
  east: null,
};

describe("parseMapBasemap", () => {
  it("accepts an XYZ url and drops a blank image", () => {
    expect(
      parseMapBasemap({
        ...empty,
        tileUrl: " https://tiles.example/maps/{z}/{x}/{y}.png ",
        imageUrl: "  ",
      }),
    ).toEqual({
      ...empty,
      tileUrl: "https://tiles.example/maps/{z}/{x}/{y}.png",
    });
  });

  it("requires both corners when an image is set", () => {
    expect(() =>
      parseMapBasemap({
        ...empty,
        imageUrl: "https://cdn.example/mnk.png",
        south: -19,
        west: 47,
      }),
    ).toThrow(/deux coins/);
  });

  it("keeps a georeferenced image", () => {
    expect(
      parseMapBasemap({
        ...empty,
        imageUrl: "https://cdn.example/mnk.png",
        south: -18.3,
        west: 47.1,
        north: -18.0,
        east: 47.4,
      }),
    ).toMatchObject({
      imageUrl: "https://cdn.example/mnk.png",
      south: -18.3,
      east: 47.4,
    });
  });
});
