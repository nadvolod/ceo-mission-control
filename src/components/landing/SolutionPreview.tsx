'use client';

import { motion } from 'framer-motion';
import { Target, Clock, Mic, DollarSign, RefreshCcw } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'AI Priority Scoring',
    description: 'Every task gets a 0-100 score based on revenue impact, urgency, and strategic alignment. Your AI knows what matters most.',
    accent: '#818cf8',
  },
  {
    icon: Clock,
    title: 'Focus Hours Tracking',
    description: 'Track deep work by category. See week-over-week growth. Know exactly where your hours go and whether they\'re moving the needle.',
    accent: '#34d399',
  },
  {
    icon: Mic,
    title: 'Voice Commands',
    description: 'Just talk. Create tasks, log hours, complete items, and update priorities — all from natural language. No typing required.',
    accent: '#f472b6',
  },
  {
    icon: DollarSign,
    title: 'Financial Dashboard',
    description: 'Revenue generated, money moved, expenses cut. One view of your financial momentum, updated from conversation.',
    accent: '#fbbf24',
  },
  {
    icon: RefreshCcw,
    title: 'AI Auto-Sync',
    description: 'Your AI assistant catches tasks from conversations and syncs them to Mission Control automatically. Nothing slips through.',
    accent: '#38bdf8',
  },
];

export function SolutionPreview() {
  return (
    <section className="relative py-28 px-6">
      {/* Subtle section divider */}
      <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-4">The solution</p>
          <h2 className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="gradient-text-accent">One command center.</span>
            <br />
            <span className="text-white">Zero noise.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* First row: 3 cards */}
          {features.slice(0, 3).map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-7 transition-all duration-500 group relative overflow-hidden"
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}40, transparent)` }} />

              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-5 h-5" style={{ color: feature.accent }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}

          {/* Second row: 2 cards, centered */}
          {features.slice(3).map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: (i + 3) * 0.1 }}
              className={`glass-card rounded-2xl p-7 transition-all duration-500 group relative overflow-hidden ${
                i === 0 ? 'md:col-start-1 md:col-end-2' : 'md:col-start-2 md:col-end-4'
              }`}
            >
              <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}40, transparent)` }} />

              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-5 h-5" style={{ color: feature.accent }} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
