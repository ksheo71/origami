import { useRoute } from './router.js'
import { GalleryPage } from './pages/GalleryPage.js'
import { ModelPage } from './pages/ModelPage.js'
import { navigate } from './router.js'

export function App() {
  const route = useRoute()
  if (route.name === 'gallery') return <GalleryPage />
  if (route.name === 'model') return <ModelPage id={route.id} />
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <p>페이지를 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/')}>갤러리로</button>
    </main>
  )
}
