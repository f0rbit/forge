import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
	const origin = site ? `${site.protocol}//${site.host}` : "https://f0rbit.github.io";
	const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
	const root = `${origin}${base}/`;

	const content = `User-agent: *
Allow: /

# LLM-friendly documentation
Sitemap: ${root}sitemap-index.xml
LLMs-Txt: ${root}llms.txt
`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain",
		},
	});
};
