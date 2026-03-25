'use client';

import { motion } from 'framer-motion';
import { Zap, Eye, Layers } from 'lucide-react';

const stats = [
  { icon: Zap, value: '10x', label: 'Faster task capture', description: 'Voice + AI vs. manual entry' },
  { icon: Eye, value: '100%', label: 'Priority visibility', description: 'Every task scored and ranked' },
  { icon: Layers, value: '1', label: 'Interface for everything', description: 'Replaces 12 scattered tools' },
];

export function SocialProof() {
  return (
    <section className="relative py-28 px-6">
      <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-10">Built by a CEO, for CEOs</p>

          <blockquote className="text-2xl md:text-3xl text-zinc-200 leading-relaxed mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            &ldquo;I built Mission Control because I was drowning in 12 tools
            and couldn&apos;t tell where my hours were going. This is the
            command center I needed.&rdquo;
          </blockquote>
          <p className="text-zinc-500 text-sm mb-16">&mdash; Nikolay, Founder</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                {stat.value}
              </div>
              <div className="text-sm font-medium text-zinc-300 mb-1">{stat.label}</div>
              <div className="text-xs text-zinc-500">{stat.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
