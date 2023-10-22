export interface Env {
	DB: D1Database
	WEBHOOK_URL: string
	SUBSCRIBED_TAGS: string[]
}

import { XMLParser } from "fast-xml-parser";

interface BlogPost {
	CfGuid: string,
	PubDate: Date,
}
async function getLastSeenBlogPost(env: Env): Promise<BlogPost | null> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM LastSeenPost ORDER BY PubDate DESC LIMIT 1"
	).all();

	if (results.length == 0) {
		return null;
	}

	return {
		CfGuid: results[0].CfGuid as string,
		PubDate: new Date(results[0].PubDate as string),
	};
}

interface BlogPostsRSSFeed {
	rss: {
		channel: {
			item: [{
				title: string,
				description: string,
				link: string,
				guid: string,
				pubDate: string,
				"content:encoded": string,
			}]
		}
	}
}
async function getBlogsRSSFeed(): Promise<BlogPostsRSSFeed> {
	let resp = await fetch('https://blog.cloudflare.com/rss/');
	let body = await resp.text();
	const xml = new XMLParser().parse(body);
	return xml;
}

async function updateMostRecentBlogPost(env: Env, blogPost: BlogPost): Promise<void> {
	// Remove existing values in the table, then add the post.
	await env.DB.prepare("DELETE FROM LastSeenPost").run();

	await env.DB.prepare(
		"INSERT INTO LastSeenPost (CfGuid, PubDate) VALUES (?, ?)"
	)
		.bind(blogPost.CfGuid, blogPost.PubDate.toISOString())
		.run();
}

async function getTagsForBlogPost(url: string): Promise<string[]> {
	let resp = await fetch(url);
	let body = await resp.text();
	const html = new XMLParser({ parseAttributeValue: true, ignoreAttributes: false }).parse(body);

	// Tags are in a <meta> tag with the property "article:tag"
	const tags = html.html.head.meta
		.filter((meta: any) => meta["@_property"] == "article:tag")
		.map((meta: any) => meta["@_content"]);

	return tags;
}

async function sendNewBlogPostWebhook(env: Env, title: string, url: string): Promise<void> {
	await fetch(env.WEBHOOK_URL, {
		method: "POST",
		body: JSON.stringify({
			title,
			url,
		}),
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export default {
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Looking for new posts with tags ${env.SUBSCRIBED_TAGS.join(", ")}`)

		const lastSeenPost = await getLastSeenBlogPost(env);

		const blogsRSSFeed = await getBlogsRSSFeed();

		if (lastSeenPost == null) {
			console.log("This is our first run, storing the most recent post and exiting")

			// This is the first time we've run this script, so we'll just store the most recent post
			const mostRecentPost = blogsRSSFeed.rss.channel.item[0];
			const blogPost: BlogPost = {
				CfGuid: mostRecentPost.guid,
				PubDate: new Date(mostRecentPost.pubDate),
			};

			await updateMostRecentBlogPost(env, blogPost);

			console.log("Done.")
			return;
		}

		const newPosts = blogsRSSFeed.rss.channel.item.filter((post) => {
			return new Date(post.pubDate) > lastSeenPost.PubDate;
		});

		console.log(`Found ${newPosts.length} new posts.`);

		for (const post of newPosts) {
			const tags = await getTagsForBlogPost(post.link);

			// Check if any tags are in SUBSCRIBED_TAGS
			if (tags.some((tag) => env.SUBSCRIBED_TAGS.includes(tag))) {
				console.log(`Found subscribed tag in post '${post.title}', sending webhook.`)

				await sendNewBlogPostWebhook(env, post.title, post.link);
			} else {
				console.log(`No subscribed tags found, skipping post '${post.title}'`)
			}
		}

		// Update the most recent post
		const mostRecentPost = blogsRSSFeed.rss.channel.item[0];
		const blogPost: BlogPost = {
			CfGuid: mostRecentPost.guid,
			PubDate: new Date(mostRecentPost.pubDate),
		};

		await updateMostRecentBlogPost(env, blogPost);

		console.log("Done.")
	}
};
