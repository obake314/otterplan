import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import App from './App.jsx'

// TODO: Google reCAPTCHA v3 サイトキーに置き換えてください
const RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <App />
    </GoogleReCaptchaProvider>
  </React.StrictMode>,
)
