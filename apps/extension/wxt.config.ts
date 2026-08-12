import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'AI Form Filler',
    description: 'Fills any form from your own knowledge base, in your own writing voice.',
    version: '0.0.1',

    permissions: [
      'storage',
      'identity',
      'sidePanel',
      // Lets the content script attach on the active tab only after the user acts,
      // instead of asking for host access to every site up front.
      'activeTab',
      'scripting',
    ],

    // Broad host access is what a general-purpose form filler needs, but it is also the
    // single scariest line in the manifest for a Web Store reviewer. The content script
    // below only observes; nothing is transmitted until the user clicks fill.
    host_permissions: ['<all_urls>'],

    oauth2: {
      // Replace with the Chrome Extension OAuth client ID from Google Cloud Console.
      client_id: '__GOOGLE_CLIENT_ID__.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile'],
    },

    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'AI Form Filler' },
  },

  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
