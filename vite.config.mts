/// <reference types="vitest" />
import path from "path";

import { defineConfig } from "vite";

import * as cheerio from "cheerio";
import * as sass from "sass";
// import { minify } from 'csso';
import { parse as parseCss, CssTypes } from "@adobe/css-tools";

import packageJson from "./package.json";

const getPackageName = () => {
	return packageJson.name;
};

const getPackageNameCamelCase = () => {
	try {
		return getPackageName().replace(/-./g, char => char[1].toUpperCase());
	} catch (err) {
		throw new Error("Name property in package.json is missing.");
	}
};

const fileName = {
	es: `${getPackageName()}.js`,
	iife: `${getPackageName()}.iife.js`,
};

const formats = Object.keys(fileName) as Array<keyof typeof fileName>;

/** @type { import('vite').Plugin } */
function toStyleTagPlugin() {
	return {
		name: "vite-plugin-tostyletag",
		async transform(src, id) {
			if (id !== path.resolve(__dirname, "index.html")) {
				return;
			}
			console.log("inside", path.resolve(__dirname, "index.html"));

			const $ = cheerio.load(src);
			const isNil = function (value: unknown) {
				return value == null;
			};

			const linkTags = $("link[to-style-tag]").toArray();
			let maybeNullStyleTags = await Promise.all(linkTags.map(async function (value, index, array) {
				let href = $(value).attr("href");
				if (href == null) {
					return null;
				}

				if (href.startsWith("/")) {
					href = href.substring(1);
				}

				const filePath = path.resolve(__dirname, href);
				const compileResult = await sass.compileAsync(filePath);
				return [value, $("<style>").html(`\n${compileResult.css}\n`)];
			}));
			const styleTags = maybeNullStyleTags.filter((value) => !isNil(value));
			for (const styleTag of styleTags) {
				$(styleTag[0]).replaceWith(styleTag[1]);
			}

			return $.html();
		}
	};
};

/** @type { import('vite').Plugin } */
function toHtmlTagsPlugin() {
	return {
		name: "vite-plugin-to-html-tags",
		async transform(src, id) {
			if (id !== path.resolve(__dirname, "index.html")) {
				return;
			}
			console.log("inside", path.resolve(__dirname, "index.html"));

			const $ = cheerio.load(src);
			const isNil = function (value: unknown) {
				return value == null;
			};

			const linkTags = $("link[to-html-tags]").toArray();
			let maybeNullCompiledResults = await Promise.all(linkTags.map(async function (value, index, array) {
				let href = $(value).attr("href");
				if (href == null) {
					return null;
				}

				if (href.startsWith("/")) {
					href = href.substring(1);
				}

				const filePath = path.resolve(__dirname, href);
				const compileResult = await sass.compileAsync(filePath);
				return compileResult.css;
			}));
			for (const linkTag of linkTags) {
				$(linkTag).remove();
			}
			const compiledResults = maybeNullCompiledResults.filter((value) => !isNil(value));
			// const joinedResult = minify(compiledResults.join("\n"));
			const parsedCss = parseCss(compiledResults.join("\n"));
			for (const rule of parsedCss.stylesheet.rules) {
				switch (rule.type) {
					case CssTypes.rule: {
						for (const selector of rule.selectors) {
							for (const declaration of rule.declarations) {
								if (declaration.type == CssTypes.declaration) {
									const value = declaration.value.replaceAll("\"", "'");
									$(selector).css(declaration.property, value);
								}
							}
						}
					} break;
					default: {
						// Do nothing.
					}
				}
			}

			return $.html();
		}
	};
};

export default defineConfig({
	plugins: [
		toStyleTagPlugin(),
		toHtmlTagsPlugin()
	],
	base: "./",
	build: {
		outDir: "./build/dist",
	},
	test: {
		watch: false,
	},
	resolve: {
		alias: [
			{ find: "@", replacement: path.resolve(__dirname, "src") },
			{ find: "@@", replacement: path.resolve(__dirname) },
		],
	},
});
