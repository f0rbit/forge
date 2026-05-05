import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import solidJs from "@astrojs/solid-js";

export default defineConfig({
	site: "https://f0rbit.github.io",
	base: "/forge",
	output: "static",
	integrations: [
		solidJs(),
		starlight({
			title: "forge",
			description: "TypeScript game engine on PIXI",
			customCss: ["./src/styles/custom.css", "./src/styles/landing.css"],
			components: {
				ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
				PageTitle: "./src/components/starlight/PageTitle.astro",
				SiteTitle: "./src/components/starlight/SiteTitle.astro",
				Footer: "./src/components/starlight/Footer.astro",
			},
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/f0rbit/forge" }],
			head: [
				{
					tag: "meta",
					attrs: {
						property: "og:image",
						content: "/forge/og-image.svg",
					},
				},
			],
			sidebar: [
				{ label: "Quick Start", slug: "quick-start" },
				{
					label: "Core Concepts",
					items: [
						{ label: "World",      slug: "core/world" },
						{ label: "Components", slug: "core/components" },
						{ label: "Queries",    slug: "core/queries" },
						{ label: "Schedule",   slug: "core/schedule" },
						{ label: "Time",       slug: "core/time" },
						{ label: "RNG",        slug: "core/rng" },
						{ label: "Resources",  slug: "core/resources" },
						{ label: "Ctx",        slug: "core/ctx" },
					],
				},
				{
					label: "Input",
					items: [
						{ label: "Action Model",     slug: "input/action-model" },
						{ label: "Presets",          slug: "input/presets" },
						{ label: "Custom Bindings",  slug: "input/custom-bindings" },
						{ label: "Querying Actions", slug: "input/querying" },
						{ label: "Input Sources",    slug: "input/sources" },
						{ label: "Rebinding",        slug: "input/rebinding" },
					],
				},
				{
					label: "Replay",
					items: [
						{ label: "Overview",      slug: "replay/overview" },
						{ label: "Format",        slug: "replay/format" },
						{ label: "Test Fixtures", slug: "replay/test-fixtures" },
					],
				},
				{
					label: "Storage",
					items: [
						{ label: "Snapshot Model",    slug: "storage/snapshot-model" },
						{ label: "Snapshotter",       slug: "storage/snapshotter" },
						{ label: "Store<T>",          slug: "storage/store-interface" },
						{ label: "Backends",          slug: "storage/backends" },
						{ label: "EngineStore",       slug: "storage/engine-store" },
						{ label: "Future Backends",   slug: "storage/future-backends" },
					],
				},
				{
					label: "Debug",
					items: [
						{ label: "Frame Buffer",      slug: "debug/frame-buffer" },
						{ label: "Per-Entity Pins",   slug: "debug/pins" },
						{ label: "Inspector",         slug: "debug/inspector" },
						{ label: "HUD Stats",         slug: "debug/hud" },
						{ label: "__DEV__ Gating",    slug: "debug/dev-gating" },
					],
				},
				{
					label: "Palette",
					items: [
						{ label: "Overview",          slug: "palette/overview" },
						{ label: "Built-in Commands", slug: "palette/built-in-commands" },
						{ label: "Custom Commands",   slug: "palette/custom-commands" },
						{ label: "Search & History",  slug: "palette/search-history" },
					],
				},
				{
					label: "PIXI Integration",
					items: [
						{ label: "boot()",            slug: "pixi/boot" },
						{ label: "Camera Modes",      slug: "pixi/camera-modes" },
						{ label: "Pixel Perfect",     slug: "pixi/pixel-perfect" },
						{ label: "Resize",            slug: "pixi/resize" },
						{ label: "Render Flow",       slug: "pixi/render-flow" },
						{ label: "Assets",            slug: "pixi/assets" },
						{ label: "Sprite",            slug: "pixi/sprite" },
						{ label: "Anim",              slug: "pixi/anim" },
					],
				},
				{
					label: "Testing",
					items: [{ label: "Test Harness", slug: "testing/test-harness" }],
				},
				{ label: "Determinism Contract", slug: "determinism" },
				{ label: "Cookbook",             slug: "cookbook" },
				{ label: "Troubleshooting",      slug: "troubleshooting" },
				{ label: "Extending",            slug: "extending" },
				{ label: "Deployment",           slug: "deployment" },
				{ label: "Versioning",           slug: "versioning" },
				{ label: "Reference",            slug: "reference" },
			],
		}),
	],
});
