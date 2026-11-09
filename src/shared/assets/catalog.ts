export const iconUrls = import.meta.glob('./icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
export const tokenUrls = import.meta.glob('./tokens/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
