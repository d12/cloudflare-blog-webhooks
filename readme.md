# Cloudflare Blog Webhooks

Cloudflare's Discord has a channel that can notify you when new posts are created, but there's no way to filter out the posts you don't care about.

This project lets you subscribe to specific blog post tags to ensure you only receive notifications for the posts you care about.

## Setup
1. Following [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/), deploy this project to Cloudflare Workers.
2. Create a new d1 DB and update the name/id in `wrangler.toml`
3. Set the `WEBHOOK_URL` environment variable to a URL where you can recieve an HTTP Post webhook.
4. Set the `SUBSCRIBED_TAGS` environment variable to a list of Cloudflare Blog tags you're interested in. For example, `["Cloudflare Stream", "Cloudflare Images"]`

# Webhook definition
```
{
  "title": BLOG_POST_TITLE,
  "url": BLOG_POST_URL,
}
```
