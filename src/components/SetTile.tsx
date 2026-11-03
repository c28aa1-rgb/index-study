import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { StudySet } from '../lib/types'
import { timeAgo } from '../lib/util'
import { item, snap } from '../lib/motion'

export function SetTile({ set }: { set: StudySet }) {
  return (
    <motion.div variants={item} layout>
      <Link to={`/set/${set.id}`} className="block rounded-xl">
        <motion.div className="relative" initial="rest" whileHover="hover" whileFocus="hover" animate="rest">
          {/* cards behind fan out on hover */}
          <motion.div
            className="absolute inset-0 rounded-xl border border-ink/10 bg-paper shadow-card"
            variants={{ rest: { rotate: 0, y: 0 }, hover: { rotate: -3, y: -4, x: -4 } }}
            transition={snap}
          />
          <motion.div
            className="absolute inset-0 rounded-xl border border-ink/10 bg-paper shadow-card"
            variants={{ rest: { rotate: 0, y: 0 }, hover: { rotate: 2.5, y: -2, x: 5 } }}
            transition={snap}
          />
          <motion.div
            className="ruled relative flex h-44 flex-col rounded-xl border border-ink/10 p-5 pt-0 shadow-card [--head:52px] [--line:28px]"
            variants={{ rest: { y: 0 }, hover: { y: -6 } }}
            transition={snap}
          >
            <div className="flex h-[52px] items-center justify-between gap-3">
              <h3 className="truncate font-display text-lg font-bold">{set.title || 'Untitled set'}</h3>
              <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 font-mono text-xs font-bold text-white">
                {set.cards.length}
              </span>
            </div>
            <p className="line-clamp-2 pt-1 text-sm leading-7 text-ink-2">
              {set.description ||
                set.cards
                  .slice(0, 3)
                  .map((c) => c.term)
                  .join(' · ')}
            </p>
            <div className="mt-auto flex items-center justify-between text-xs text-ink-3">
              <span>{set.author_name}</span>
              <span>{timeAgo(set.updated_at)}</span>
            </div>
          </motion.div>
        </motion.div>
      </Link>
    </motion.div>
  )
}
