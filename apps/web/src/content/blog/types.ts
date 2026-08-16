export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readingTime: string
  category: string
  content: BlogBlock[]
}
