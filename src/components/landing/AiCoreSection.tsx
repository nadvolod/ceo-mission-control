'use client';

import { motion } from 'framer-motion';
import { Brain, Sparkles, TrendingUp, MessageSquare, Shield, Lightbulb } from 'lucide-react';

const traits = [
  { icon: MessageSquare, text: 'Understands natural language — talk to it like a chief of staff' },
  { icon: TrendingUp, text: 'Learns your patterns and gets smarter with every interaction' },
  { icon: Brain, text: 'Connects the dots across tasks, finances, team, and time' },
  { icon: Lightbulb, text: 'Proactively surfaces what matters before you ask' },
  { icon: Shield, text: 'Your data, your model — private and secure by design' },
];

export function AiCoreSection() {
  return (
    <section className="relative py-28 px-6">
      <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: messaging */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 mb-6">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] tracking-widest uppercase text-purple-300">The brain behind it all</span>
            </div>

            <h2 className="text-3xl md:text-4xl tracking-tight text-white mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              One AI that runs<br />
              <span className="gradient-text-accent">everything — and keeps</span><br />
              <span className="gradient-text-accent">getting better</span>
            </h2>

            <p className="text-zinc-400 leading-relaxed mb-8">
              Every feature in Mission Control is powered by a single AI core that learns
              how you work, what you prioritize, and where your time creates the most value.
              It doesn&apos;t just track — it coaches you to become a more effective CEO,
              every single day.
            </p>

            <div className="space-y-4">
              {traits.map((trait, i) => (
                <motion.div
                  key={trait.text}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <trait.icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm text-zinc-300">{trait.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Concentric rings */}
            <div className="relative w-full aspect-square max-w-[400px] mx-auto">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-[15%] rounded-full border border-white/[0.06]" />
              <div className="absolute inset-[30%] rounded-full border border-white/[0.08]" />
              <div className="absolute inset-[42%] rounded-full border border-purple-500/10" />

              {/* Center brain */}
              <div className="absolute inset-[42%] rounded-full bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center">
                <Brain className="w-10 h-10 text-purple-400 pulse-glow" />
              </div>

              {/* Orbiting nodes */}
              {[
                { label: 'Tasks', angle: 30, dist: '18%', color: '#818cf8' },
                { label: 'Focus', angle: 100, dist: '12%', color: '#34d399' },
                { label: 'Finance', angle: 170, dist: '18%', color: '#fbbf24' },
                { label: 'Team', angle: 240, dist: '14%', color: '#f97316' },
                { label: 'Ops', angle: 310, dist: '16%', color: '#14b8a6' },
              ].map((node) => {
                const rad = (node.angle * Math.PI) / 180;
                const r = 38;
                const x = 50 + r * Math.cos(rad);
                const y = 50 + r * Math.sin(rad);
                return (
                  <div
                    key={node.label}
                    className="absolute"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"
                        style={{ boxShadow: `0 0 16px ${node.color}15` }}
                      >
                        <span className="text-[9px] font-bold" style={{ color: node.color }}>{node.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Animated pulse from center */}
              <div className="absolute inset-[42%] rounded-full border border-purple-500/20 pulse-glow" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
