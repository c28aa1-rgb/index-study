import { motion } from 'framer-motion'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { snap } from '../lib/motion'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'
import { SoundToggle } from './SoundToggle'

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Index home">
      <motion.span className="relative block h-7 w-8 sm:w-10" whileHover="hover">
        <motion.span
          className="absolute inset-0 rounded-[5px] border-2 border-ink bg-paper"
          variants={{ hover: { rotate: -8, x: -3 } }}
          transition={snap}
        />
        <motion.span
          className="absolute inset-0 rounded-[5px] border-2 border-ink bg-paper"
          variants={{ hover: { rotate: 4, x: 2, y: -2 } }}
          transition={snap}
        >
          <span className="absolute left-0 right-0 top-[7px] h-[1.5px] bg-margin" />
          <span className="absolute left-1.5 right-2 top-[13px] h-[1.5px] bg-rule" />
        </motion.span>
      </motion.span>
      <span className="font-display text-lg font-extrabold tracking-tight sm:text-xl">
        Index
      </span>
    </Link>
  )
}

const links = [
  { to: '/', label: 'Library' },
  { to: '/explore', label: 'Explore' },
]

export function Nav() {
  const { user, ready } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const studying = /\/(flashcards|learn|test|match|review)$/.test(loc.pathname)
  if (studying || loc.pathname === '/auth') return null
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-desk/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) =>
                `relative px-3 py-1.5 text-sm font-semibold ${isActive ? 'text-ink' : 'text-ink-3 hover:text-ink'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-ink"
                      className="absolute inset-x-2 -bottom-[17px] h-[3px] rounded-full bg-margin"
                      transition={snap}
                    />
                  )}
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle />
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={snap}
            onClick={() => nav('/create')}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-sm font-semibold text-white shadow-[0_3px_0_#0a1226]"
          >
            <span className="text-lg leading-none">+</span> New set
          </motion.button>
          {ready &&
            (user ? (
              <button
                onClick={async () => {
                  const { error } = await supabase!.auth.signOut()
                  if (error) toast(error.message)
                  else nav('/')
                }}
                className="h-9 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-desk-2"
                title={user.email}
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex h-9 items-center rounded-xl border-2 border-ink px-3 text-sm font-semibold hover:bg-paper"
              >
                Sign in
              </Link>
            ))}
        </div>
      </div>
      <nav className="flex gap-1 px-4 pb-2 sm:hidden">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-1 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink-3'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
