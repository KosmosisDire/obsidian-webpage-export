const { build } = require("esbuild");

// build normal js for web
build
({
	entryPoints: ["main/website.ts", "main/testentry.ts"],
	bundle: true,
	minify: false,
	platform: 'browser',
	outdir: "./dist",
	watch: true,
});
