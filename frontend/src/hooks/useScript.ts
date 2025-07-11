import { useEffect, useState } from 'react'

export type ScriptStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useScript(src: string): ScriptStatus {
  const [status, setStatus] = useState<ScriptStatus>(src ? 'loading' : 'idle')

  useEffect(() => {
    if (!src) {
      setStatus('idle')
      return
    }

    let script: HTMLScriptElement | null = document.querySelector(
      `script[src="${src}"]`
    )

    if (!script) {
      script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      script.setAttribute('data-status', 'loading')
      document.body.appendChild(script)
    } else {
      setStatus((script.getAttribute('data-status') as ScriptStatus) || 'ready')
    }

    const updateStatus = (event: Event) => {
      const newStatus: ScriptStatus = event.type === 'load' ? 'ready' : 'error'
      script?.setAttribute('data-status', newStatus)
      setStatus(newStatus)
    }

    script.addEventListener('load', updateStatus)
    script.addEventListener('error', updateStatus)

    return () => {
      if (script) {
        script.removeEventListener('load', updateStatus)
        script.removeEventListener('error', updateStatus)
      }
    }
  }, [src])

  return status
} 