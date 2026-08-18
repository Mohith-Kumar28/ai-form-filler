import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { formatDate, getPost, getPosts } from '@/lib/blog'
import { buildMeta, canonicalLink, jsonLd } from '@/lib/seo'
import { site } from '@/lib/site'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    return { post }
  },
  head: ({ loaderData }) => {
    const { post } = loaderData!
    return {
      meta: buildMeta({
        title: `${post.title} — ${site.name}`,
        description: post.description,
        path: `/blog/${post.slug}`,
      }),
      links: [canonicalLink(`/blog/${post.slug}`)],
      scripts: [
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { '@type': 'Organization', name: site.name },
          publisher: { '@type': 'Organization', name: site.name },
        }),
      ],
    }
  },
  notFoundComponent: NotFound,
  component: BlogPostPage,
})

function BlogPostPage() {
  const { post } = Route.useLoaderData()

  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <article className="mx-auto max-w-3xl px-6">
        <Reveal>
          <header>
            <Link to="/blog" className="text-[13px] text-ink-dim no-underline hover:text-accent">
              ← All posts
            </Link>
            <div className="mt-6 flex items-center gap-3">
              <span className="rounded-xl bg-surface-muted px-2 py-0.5 text-[11px] text-ink-dim">
                {post.category}
              </span>
              <time className="font-sans text-[11px] text-ink-dim">
                {formatDate(post.date)} · {post.readingTime}
              </time>
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink md:text-4xl">
              {post.title}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{post.description}</p>
          </header>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="space-y-6">
            {post.content.map((block, idx) => {
              if (block.type === 'h2') {
                return (
                  <h2
                    // biome-ignore lint/suspicious/noArrayIndexKey: static content blocks never reorder
                    key={`h2-${idx}`}
                    className="pt-2 text-xl font-semibold text-ink"
                  >
                    {block.text}
                  </h2>
                )
              }
              if (block.type === 'ul') {
                return (
                  <ul
                    // biome-ignore lint/suspicious/noArrayIndexKey: static content blocks never reorder
                    key={`ul-${idx}`}
                    className="space-y-2.5 pl-1"
                  >
                    {block.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-muted"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          className="mt-1 h-3 w-3 shrink-0 text-accent"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="miter"
                          aria-hidden="true"
                        >
                          <path d="M4 8 L7 11 L12 5" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )
              }
              return (
                <p
                  // biome-ignore lint/suspicious/noArrayIndexKey: static content blocks never reorder
                  key={`p-${idx}`}
                  className="text-[15px] leading-[1.75] text-ink-muted"
                >
                  {block.text}
                </p>
              )
            })}
          </div>
        </Reveal>
      </article>
    </div>
  )
}

function NotFound() {
  return (
    <div className="pt-32 pb-20 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">404</p>
      <h1 className="mt-4 text-3xl font-semibold text-ink">Post not found</h1>
      <Link to="/blog" className="mt-6 inline-block text-accent no-underline hover:underline">
        Back to the blog
      </Link>
    </div>
  )
}
