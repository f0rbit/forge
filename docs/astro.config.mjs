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
			customCss: ["./src/styles/custom.css"],
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
						content: "/forge/og-image.png",
					},
				},
			],
			sidebar: [
				{ label: "Welcome", slug: "index" },
			],
		}),
	],
});
