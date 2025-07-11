import React from 'react'
import ProfileForm from '../components/ProfileForm'

const Register: React.FC = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '600px',
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h1 style={{ 
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '8px'
        }}>
          Complete Your Profile
        </h1>
        <p style={{ 
          fontSize: '16px',
          color: '#666',
          lineHeight: '1.5'
        }}>
          Please fill out your profile to access game features. All fields marked with * are required.
        </p>
      </div>
      
      <ProfileForm />
    </div>
  )
}

export default Register 