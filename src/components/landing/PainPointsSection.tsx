'use client';

import { motion } from 'framer-motion';
import { BrainCog, Compass, Clock, Zap, Users, DollarSign } from 'lucide-react';

const pains = [
  {
    icon: BrainCog,
    title: 'Context Switching Kills Deep Work',
    description: 'You jump between Slack, email, spreadsheets, and 9 other tools. Your best thinking gets fragmented before it starts.',
    color: 'text-rose-400',
    glow: 'rgba(244, 63, 94, 0.06)',
  },
  {
    icon: Compass,
    title: 'No Single Source of Truth',
    description: 'Priorities live in your head, notebooks, voice notes, and 4 different apps. Nothing syncs. Nothing sticks.',
    color: 'text-blue-400',
    glow: 'rgba(59, 130, 246, 0.06)',
  },
  {
    icon: Users,
    title: 'Blind to Team Performance',
    description: 'You delegate but lose track. Who\'s delivering? Who\'s blocked? You find out in standup — three days too late.',
    color: 'text-orange-400',
    glow: 'rgba(251, 146, 60, 0.06)',
  },
  {
    icon: DollarSign,
    title: 'Cash Metrics in Spreadsheets',
    description: 'Revenue, burn rate, runway, and pipeline live in 4 different spreadsheets. You check them once a week — if you remember.',
    color: 'text-emerald-400',
    glow: 'rgba(52, 211, 153, 0.06)',
  },
  {
    icon: Clock,
    title: "Can't Measure Operational Efficiency",
    description: 'No idea what your operations actually cost per outcome. Bottlenecks hide until they\'re already on fire.',
    color: 'text-teal-400',
    glow: 'rgba(20, 184, 166, 0.06)',
  },
  {
    icon: Zap,
    title: 'Decision Fatigue by 2 PM',
    description: '50 things competing for attention. No AI-powered ranking. You\'re the bottleneck in your own company.',
    color: 'text-amber-400',
    glow: 'rgba(251, 191, 36, 0.06)',
  },
];

export function PainPointsSection() {
  return (
    <section className="relative py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-4">The problem</p>
          <h2 className="text-3xl md:text-5xl tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Running a company shouldn&apos;t<br />feel like running in circles
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pains.map((pain, i) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-8 transition-all duration-500 group"
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: `0 0 20px ${pain.glow}` }}
                >
                  <pain.icon className={`w-5 h-5 ${pain.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{pain.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{pain.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
