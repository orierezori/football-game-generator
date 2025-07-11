import React from 'react'
import GoogleLoginButton from '../components/GoogleLoginButton'

const enableMagicLink =
  import.meta.env.VITE_ENABLE_MAGIC_LINK?.toString().toLowerCase() === 'true'

const Login: React.FC = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <h1>Welcome to Football Game Generator</h1>
      <p>Sign in to access your games and profile</p>
      
      {!enableMagicLink && <GoogleLoginButton />}
      
      {enableMagicLink && (
        <div>
          <p>Magic link login is enabled but not implemented yet.</p>
          <GoogleLoginButton />
        </div>
      )}
    </div>
  )
}

export default Login 