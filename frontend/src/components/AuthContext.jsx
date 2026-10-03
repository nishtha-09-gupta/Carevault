import { createContext, useContext, useEffect, useState } from 'react'
import { demoSignIn, getCurrentUser, signIn, signOut, signUp } from '../services/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getCurrentUser().then(({ user: current }) => { if (active) setUser(current) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const value = {
    user,
    loading,
    async signIn(details) { const result = await signIn(details); setUser(result.user); return result.user },
    async demoSignIn() { const result = await demoSignIn(); setUser(result.user); return result.user },
    async signUp(details) { const result = await signUp(details); setUser(result.user); return result.user },
    async signOut() { try { await signOut() } finally { setUser(null) } },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
