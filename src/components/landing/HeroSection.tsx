'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Loader2, BarChart3, ListTodo, Clock, DollarSign } from 'lucide-react';

const EMPLOYEE_OPTIONS = [
  { value: '', label: 'Company size' },
  { value: '1', label: 'Just me' },
  { value: '2-5', label: '2–5 employees' },
  { value: '6-20', label: '6–20 employees' },
  { value: '21-50', label: '21–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '200+', label: '200+ employees' },
];

export function HeroSection() {
  const [form, setForm] = useState({ email: '', name: '', title: '', company: '', employeeCount: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.name.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        if (res.status === 409) setStatus('success');
        else { setStatus('error'); }
      }
    } catch {
      setStatus('error');
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm';

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Radar sweep background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#06060a]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140vmax] h-[140vmax]">
          <div className="radar-sweep absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(99, 102, 241, 0.08) 30deg, transparent 60deg)',
            }}
          />
        </div>
        {/* Radial gradient center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)' }}
        />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        <div className="absolute inset-0 film-grain" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs tracking-widest uppercase text-indigo-300 font-medium">Coming Soon</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-8xl font-normal tracking-tight leading-[0.95] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="gradient-text">Your AI</span>
          <br />
          <span className="gradient-text">Chief of Staff</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Stop drowning in 12 tools. One command center for your priorities,
          focus hours, finances, and decisions &mdash; powered by AI that
          actually understands what moves the needle.
        </motion.p>

        {/* Email capture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {status === 'success' ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span>You&apos;re on the list. We&apos;ll be in touch.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8 max-w-xl mx-auto space-y-3 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Full name *" required value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} />
                <input type="email" placeholder="Work email *" required value={form.email} onChange={e => update('email', e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Title (e.g. CEO, Founder)" value={form.title} onChange={e => update('title', e.target.value)} className={inputClass} />
                <input type="text" placeholder="Company" value={form.company} onChange={e => update('company', e.target.value)} className={inputClass} />
              </div>
              <select value={form.employeeCount} onChange={e => update('employeeCount', e.target.value)}
                className={`${inputClass} ${!form.employeeCount ? 'text-zinc-500' : ''} appearance-none cursor-pointer`}
              >
                {EMPLOYEE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0c0c14] text-white">{opt.label}</option>
                ))}
              </select>
              {status === 'error' && <p className="text-red-400 text-sm">Something went wrong. Try again.</p>}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium transition-all disabled:opacity-50 cursor-pointer"
              >
                {status === 'loading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</>
                ) : (
                  <>Get Early Access <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <p className="text-center text-xs text-zinc-600">No spam. Early access only.</p>
            </form>
          )}
        </motion.div>

        {/* Floating dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.6 }}
          className="mt-20 float-slow"
          style={{ perspective: '1200px' }}
        >
          <div className="relative mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-[#0c0c14]/80 backdrop-blur-xl p-6 shadow-2xl shadow-indigo-500/5"
            style={{ transform: 'rotateX(8deg) rotateY(-6deg)' }}
          >
            {/* Mock dashboard header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-[10px] text-zinc-600 tracking-wider uppercase">CEO Mission Control</span>
            </div>

            {/* Mock stats row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { icon: ListTodo, label: 'Active Tasks', value: '12', color: 'text-blue-400' },
                { icon: Clock, label: 'Focus Hours', value: '6.5h', color: 'text-emerald-400' },
                { icon: DollarSign, label: 'Revenue', value: '$47K', color: 'text-amber-400' },
                { icon: BarChart3, label: 'AI Score', value: '94', color: 'text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color} mb-1.5`} />
                  <div className="text-lg font-semibold text-white">{stat.value}</div>
                  <div className="text-[10px] text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Mock task rows */}
            <div className="space-y-2">
              {[
                { score: 95, title: 'Close Artis WHO contract', tag: 'Revenue', money: '$12K' },
                { score: 82, title: 'Complete client delivery sprint', tag: 'Temporal', money: '$10K' },
                { score: 71, title: 'File taxes by April 15', tag: 'Tax', money: '' },
              ].map((task) => (
                <div key={task.title} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.03] px-3 py-2">
                  <span className={`text-xs font-mono font-bold ${task.score > 90 ? 'text-red-400' : task.score > 75 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {task.score}
                  </span>
                  <span className="text-sm text-zinc-300 flex-1">{task.title}</span>
                  {task.money && <span className="text-[10px] text-emerald-400/70">{task.money}</span>}
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-500">{task.tag}</span>
                </div>
              ))}
            </div>

            {/* Glow effect underneath */}
            <div className="absolute -bottom-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
