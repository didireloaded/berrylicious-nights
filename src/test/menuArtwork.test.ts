import { describe, expect, it } from "vitest";
import { menuItems } from "@/data/menu";
import { categoryArtwork, menuArtwork } from "@/lib/menuArtwork";

describe("food photography attribution", () => {
  it("does not claim a category picture is an exact dish photograph", () => {
    for (const item of menuItems) {
      expect(menuArtwork(item).isExactDish).toBe(Boolean(item.verifiedImage));
    }
  });

  it("provides imagery only when a representative category photo exists", () => {
    expect(categoryArtwork("All")).toBeTruthy();
    expect(categoryArtwork("Burgers")).toBeTruthy();
    expect(categoryArtwork("Salads")).toBeNull();
  });

  it("handles an unknown category without inventing an image", () => {
    expect(categoryArtwork("Not on the menu")).toBeNull();
  });
});
