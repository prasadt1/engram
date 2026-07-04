import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App.tsx'
import { FirebaseAuthProvider } from './auth/FirebaseAuthProvider.tsx'
import { ToastHost } from './components/ToastHost'
import { SpeechProvider } from './lib/SpeechContext'
import { initTheme } from './lib/theme'
import { migrateLegacyStorageKeys } from './lib/storageMigration'

migrateLegacyStorageKeys()
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseAuthProvider>
      <SpeechProvider>
        <ToastHost>
          <App />
        </ToastHost>
      </SpeechProvider>
    </FirebaseAuthProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* optional PWA shell */
    })
  })
}
