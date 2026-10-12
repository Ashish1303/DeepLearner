export type Resource = 'technology' | 'path' | 'module' | 'topic';
export function validId(id: string): boolean {
  return /^[a-f0-9]{24}(?![\s\S])/i.test(id);
}
export function learningRoute(resource: Resource, id: string): string {
  if (!validId(id)) throw new Error('Invalid catalog route');
  const value = id.toLowerCase();
  switch (resource) {
    case 'technology':
      return `/explore-technologies/${value}/learning-paths`;
    case 'path':
      return `/learning-paths/${value}`;
    case 'module':
      return `/modules/${value}`;
    case 'topic':
      return `/topics/${value}`;
  }
}
export function isLearningRoute(path: string): boolean {
  return (
    path.startsWith('/explore-technologies/') ||
    ['/learning-paths/', '/modules/', '/topics/', '/concepts/'].some((prefix) =>
      path.startsWith(prefix),
    )
  );
}
export function learningHeader(path: string): string {
  if (path.startsWith('/concepts/')) return 'Concept Read';
  if (path.startsWith('/modules/')) return 'Module overview';
  if (path.startsWith('/topics/')) return 'Topic overview';
  return 'Learning paths';
}
