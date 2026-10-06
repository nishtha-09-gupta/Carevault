import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getCurrentUser, signIn, signOut as signOutRequest, signUp } from '../services/authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const authRevision = useRef(0)

  useEffect(() => {
    let active = true
    const revision = ++authRevision.current
    getCurrentUser()
      .then(({ user: current }) => {
        if (active && authRevision.current === revision) setUser(current)
      })
      .catch(() => {
        if (active && authRevision.current === revision) setUser(null)
      })
      .finally(() => {
        if (active && authRevision.current === revision) setLoading(false)
      })
    return () => { active = false; authRevision.current += 1 }
  }, [])

  async function establishSession(authenticate) {
    const revision = ++authRevision.current
    setUser(null)
    setLoading(true)
    try {
      await authenticate()
      // The signed HttpOnly cookie is the authority; confirm the session and role from /me.
      const { user: current } = await getCurrentUser()
      if (authRevision.current !== revision) throw new Error('The authentication state changed. Please continue with the current session.')
      setUser(current)
      return current
    } catch (error) {
      if (authRevision.current === revision) setUser(null)
      throw error
    } finally {
      if (authRevision.current === revision) setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signIn(details) { return establishSession(() => signIn(details)) },
    signUp(details) { return establishSession(() => signUp(details)) },
    async signOut() {
      const revision = ++authRevision.current
      // Hide the previous account immediately while the server invalidates its session.
      setUser(null)
      setLoading(false)
      try {
        await signOutRequest()
        // A successful logout clears the cookie; this confirms there is no current session.
        await getCurrentUser().catch(() => null)
      } finally {
        if (authRevision.current === revision) {
          setUser(null)
          setLoading(false)
        }
      }
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
