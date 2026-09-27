import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { useAuth } from '@/hooks'
import { cn } from '@/lib/utils'

/** Google's four-colour "G". Inline so it never depends on a CDN. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
      />
    </svg>
  )
}

export type GoogleButtonSize = 'sm' | 'md' | 'lg'
export type GoogleButtonTone = 'solid' | 'outline' | 'onDark'

const SIZES: Record<GoogleButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px] gap-2',
  md: 'h-10 px-5 text-sm gap-2.5',
  lg: 'h-12 px-6 text-[15px] gap-3',
}

const TONES: Record<GoogleButtonTone, string> = {
  solid: 'bg-forest-800 text-ivory-50 hover:bg-forest-900 hover:shadow-hairline',
  outline: 'border border-hairline-strong bg-paper text-forest-900 hover:border-terracotta-400',
  onDark: 'bg-ivory-50 text-forest-900 hover:bg-ivory-100',
}

export interface GoogleButtonProps {
  label?: string
  size?: GoogleButtonSize
  tone?: GoogleButtonTone
  fullWidth?: boolean
  /** Where Google should return the traveller. Defaults to the callback route. */
  redirectTo?: string
  className?: string
}

/**
 * The single sign-in action for the whole product.
 *
 * Every entry point — header, footer, sign-in route, protected route — renders
 * this same button, so there is exactly one code path into an account.
 */
export function GoogleButton({
  label = 'Continue with Google',
  size = 'md',
  tone = 'solid',
  fullWidth,
  redirectTo,
  className,
}: GoogleButtonProps) {
  const { signInWithGoogle, isSigningIn, isConfigured } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    const failure = await signInWithGoogle(redirectTo)
    if (failure) setError(failure)
  }

  return (
    <div className={cn(fullWidth && 'w-full')}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isSigningIn || !isConfigured}
        aria-busy={isSigningIn || undefined}
        className={cn(
          'inline-flex select-none items-center justify-center rounded-full font-medium tracking-tight transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-px disabled:pointer-events-none disabled:opacity-55',
          SIZES[size],
          TONES[tone],
          fullWidth && 'w-full',
          className,
        )}
      >
        {isSigningIn ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-white p-0.5">
            <GoogleMark className="size-4" />
          </span>
        )}
        {label}
      </button>

      {!isConfigured && (
        <p className="mt-2 text-xs leading-relaxed text-caution">
          Sign-in is not connected in this environment yet.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-critical">
          {error}
        </p>
      )}
    </div>
  )
}
