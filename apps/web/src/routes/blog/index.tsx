import { createFileRoute, Link } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { formatDate, getPosts } from '@/lib/blog'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Blog'
const description =
  'Guides and comparisons on filling forms automatically — job applications, Google Forms, surveys, and choosing the right AI form filler.'

export const Route = createFileRoute('/blog/')({
  head: () => ({
    meta: buildMeta({ title: `${title} — ${site.name}`, description, path: '/blog' }),
    links: [canonicalLink('/blog')],
  }),
  component: BlogIndex,
})

function BlogIndex() {
  const posts = getPosts()

  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">Blog</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-ink-muted">
            {description}
          </p>
        </Reveal>

        <div className="mt-14 divide-y divide-border border-t border-b border-border">
          {posts.map((post, idx) => (
            <Reveal key={post.slug} delay={idx * 0.08}>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group flex flex-col gap-2 py-6 no-underline transition-colors duration-150 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <div className="flex items-center gap-3 sm:w-40 sm:shrink-0 sm:flex-col sm:items-start sm:gap-1">
                  <span className="rounded-xl bg-surface-muted px-2 py-0.5 text-[11px] text-ink-dim">
                    {post.category}
                  </span>
                  <time className="font-sans text-[11px] text-ink-dim">
                    {formatDate(post.date)}
                  </time>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ink transition-colors duration-150 group-hover:text-accent">
                    {post.title}
                  </h2>
                  <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-ink-muted">
                    {post.description}
                  </p>
                  <p className="mt-2 font-sans text-[11px] text-ink-dim">{post.readingTime}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
