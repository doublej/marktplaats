import { describe, expect, test } from "bun:test";
import { load } from "cheerio";
import { extractImages } from "./detail";

const IMG = "https://images.marktplaats.com/api/v1/hz-mp-pro-listing/images";

function page(body: string): ReturnType<typeof load> {
	return load(`<html><head>${body}</head><body></body></html>`);
}

describe("extractImages", () => {
	test("returns the full JSON-LD gallery, in order", () => {
		const $ = page(`
			<script type="application/ld+json">
				{"@type":"Product","image":["${IMG}/a?rule=eps$_86","${IMG}/b?rule=eps$_86","${IMG}/c?rule=eps$_86"]}
			</script>
			<meta property="og:image" content="${IMG}/a?rule=eps$_83">
		`);
		expect(extractImages($)).toEqual([
			`${IMG}/a?rule=eps$_86`,
			`${IMG}/b?rule=eps$_86`,
			`${IMG}/c?rule=eps$_86`,
		]);
	});

	test("keeps one entry per image when size variants repeat it", () => {
		const $ = page(`
			<meta property="og:image" content="${IMG}/a?rule=eps$_83">
			<div class="Gallery"><img src="//images.marktplaats.com/api/v1/hz-mp-pro-listing/images/a?rule=eps$_85"></div>
		`);
		expect(extractImages($)).toEqual([`${IMG}/a?rule=eps$_85`]);
	});

	test("skips JSON-LD nodes that are not the listing product", () => {
		const $ = page(`
			<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
			<script type="application/ld+json">not json</script>
			<script type="application/ld+json">[{"@type":"Product","image":"${IMG}/a?rule=eps$_86"}]</script>
		`);
		expect(extractImages($)).toEqual([`${IMG}/a?rule=eps$_86`]);
	});
});
