import assert from "node:assert/strict";
import test from "node:test";
import { feelings, matchFeeling, resolveDesign, themeOptions } from "./feelings.ts";
import { API_URL, assetUrl } from "./api.ts";

const examples = [
  ["I love you, forever. You feel like home.", "romantic", "love"],
  ["I miss you. Counting the days until we meet.", "romantic", "longing"],
  ["Thank you for being there. I am so grateful.", "romantic", "gratitude"],
  ["Happy birthday! Let's celebrate you.", "birthday", "joy"],
  ["Thank you, bestie, for always showing up.", "friendship", "gratitude"],
  ["I am sorry. Please take your time.", "romantic", "gentle"],
  ["Here for you through this hard time.", "friendship", "gentle"],
  ["Tumhari yaad aati hai.", "romantic", "longing"],
  ["Tumse bahut pyaar hai.", "romantic", "love"],
  ["Maaf karna, I want to listen.", "friendship", "gentle"],
  ["Shukriya for everything.", "romantic", "gratitude"],
  ["I'm not sorry. I'm grateful.", "friendship", "gratitude"],
  ["I don't love you anymore.", "romantic", "gentle"],
  ["I don\u2019t love you anymore.", "romantic", "gentle"],
  ["You are not alone.", "romantic", "gentle"],
  ["A glove and clover in a lovely drawing.", "friendship", "gratitude"],
  ["", "birthday", "joy"],
  ["   ", "romantic", "love"],
  ["A completely personal inside joke.", "friendship", "gratitude"],
  ["Happy birthday and thank you.", "apology", "gentle"],
];

for (const [message, occasion, expected] of examples) {
  test(`matches ${expected}: ${message || "(empty)"}`, () => {
    assert.equal(matchFeeling(message, occasion).id, expected);
  });
}

test("matching is repeatable and does not retain regex state", () => {
  for (let i = 0; i < 5; i++) assert.equal(matchFeeling("I miss you.", "romantic").id, "longing");
});

test("unknown language uses the selected occasion, without claiming understanding", () => {
  assert.equal(matchFeeling("\u4f60\u597d", "friendship").source, "occasion");
});

test("automatic palette follows the feeling as the message changes", () => {
  assert.equal(resolveDesign("I love you", "romantic").theme, "petal");
  assert.equal(resolveDesign("I miss you", "romantic").theme, "starlight");
});

test("manual palettes survive message changes and keep automatic mood matching", () => {
  const design = resolveDesign("I miss you", "romantic", null, "peach");
  assert.equal(design.theme, "peach");
  assert.equal(design.feeling, "longing");
  assert.equal(design.automaticTheme, false);
  assert.equal(design.automaticFeeling, true);
});

test("sender can override and reset both mood and palette", () => {
  const manual = resolveDesign("I miss you", "romantic", "joy", "mint");
  assert.equal(manual.feeling, "joy");
  assert.equal(manual.theme, "mint");
  assert.equal(resolveDesign("I miss you", "romantic").theme, "starlight");
});

test("all feelings resolve to an existing palette", () => {
  const ids = new Set(themeOptions.map((theme) => theme.id));
  for (const feeling of Object.values(feelings)) assert.ok(ids.has(feeling.theme));
});

test("preview media uses local object URLs without prepending the API host", () => {
  assert.equal(assetUrl("blob:http://localhost:3000/preview"), "blob:http://localhost:3000/preview");
  assert.equal(assetUrl("https://example.com/photo.png"), "https://example.com/photo.png");
  assert.match(assetUrl("/api/media/photo.png"), /\/api\/media\/photo\.png$/);
});

test("API and uploaded media use the website origin unless explicitly configured", () => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
  assert.equal(API_URL, configured);
  assert.equal(assetUrl("/api/media/photo.png"), `${configured}/api/media/photo.png`);
});
