import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../assets/tailwind.css'
import { chromeStoragePersister, queryClient } from '../../lib/query.js'
import { App } from './App.js'

const container = document.getElementById('root')
if (!container) throw new Error('side panel root element is missing')

createRoot(container).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: chromeStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
