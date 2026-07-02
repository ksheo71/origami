import { useSyncExternalStore } from 'react'

export type Route = { name: 'gallery' } | { name: 'model'; id: string } | { name: 'notFound' }

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'gallery' }
  const match = pathname.match(/^\/model\/([^/]+)\/?$/)
  if (match && match[1]) return { name: 'model', id: decodeURIComponent(match[1]) }
  return { name: 'notFound' }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  )
  return parseRoute(pathname)
}

export function navigate(path: string): void {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
