const { build } = require("esbuild");

// build normal js for web
build
({
	entryPoints: ["main/website.txt.ts", "main/testentry.txt.ts"],
	bundle: true,
	minify: false,
	platform: 'browser',
	outdir: "./dist",
	watch: true,
});
