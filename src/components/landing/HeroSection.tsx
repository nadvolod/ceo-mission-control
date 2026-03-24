'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Loader2, BarChart3, ListTodo, Clock, DollarSign, TrendingUp, Mic, Target } from 'lucide-react';

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

        {/* Animated dashboard views */}
        <DashboardCarousel />
      </div>
    </section>
  );
}

/* ===== Animated Dashboard Carousel ===== */

const VIEWS = [
  { label: 'AI Priorities', icon: Target },
  { label: 'Focus Hours', icon: Clock },
  { label: 'Financial', icon: DollarSign },
];

function DashboardCarousel() {
  const [activeView, setActiveView] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveView(v => (v + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 0.6 }}
      className="mt-20"
    >
      {/* View selector tabs */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {VIEWS.map((view, i) => (
          <button
            key={view.label}
            onClick={() => setActiveView(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeView === i
                ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            <view.icon className="w-3 h-3" />
            {view.label}
          </button>
        ))}
      </div>

      {/* Dashboard frame */}
      <div className="relative mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-[#0c0c14]/80 backdrop-blur-xl p-6 shadow-2xl shadow-indigo-500/5 overflow-hidden"
        style={{ perspective: '1200px' }}
      >
        {/* Window chrome */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[10px] text-zinc-600 tracking-wider uppercase">CEO Mission Control</span>
        </div>

        {/* Stats row (always visible) */}
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

        {/* Animated view content */}
        <div className="relative min-h-[180px]">
          <AnimatePresence mode="wait">
            {activeView === 0 && <TaskPriorityView key="tasks" />}
            {activeView === 1 && <FocusHoursView key="focus" />}
            {activeView === 2 && <FinancialView key="financial" />}
          </AnimatePresence>
        </div>

        {/* Bottom glow */}
        <div className="absolute -bottom-px left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      </div>
    </motion.div>
  );
}

/* ===== Dashboard View: AI Task Priorities ===== */

function TaskPriorityView() {
  const tasks = [
    { score: 95, title: 'Close Artis WHO contract', tag: 'Revenue', money: '$12K', status: 'doing' },
    { score: 82, title: 'Complete client delivery sprint', tag: 'Temporal', money: '$10K', status: 'doing' },
    { score: 71, title: 'File taxes by April 15', tag: 'Tax', money: '', status: 'todo' },
    { score: 65, title: 'Devonshire HELOC follow-up', tag: 'Finance', money: '$75K', status: 'todo' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-medium text-zinc-400">AI-Ranked Priorities</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <motion.div
            key={task.title}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.03] px-3 py-2.5"
          >
            <span className={`text-xs font-mono font-bold w-6 text-right ${
              task.score > 90 ? 'text-red-400' : task.score > 75 ? 'text-amber-400' : 'text-zinc-500'
            }`}>
              {task.score}
            </span>
            <div className={`w-2 h-2 rounded-full ${
              task.status === 'doing' ? 'bg-blue-400' : 'bg-zinc-600'
            }`} />
            <span className="text-sm text-zinc-300 flex-1 truncate">{task.title}</span>
            {task.money && <span className="text-[10px] text-emerald-400/70 font-medium">{task.money}</span>}
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-500">{task.tag}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ===== Dashboard View: Focus Hours ===== */

function FocusHoursView() {
  const days = [
    { day: 'Mon', hours: 5.5, categories: { Temporal: 3.5, Revenue: 1.5, Admin: 0.5 } },
    { day: 'Tue', hours: 7.0, categories: { Temporal: 4.0, Revenue: 2.0, Tax: 1.0 } },
    { day: 'Wed', hours: 4.5, categories: { Temporal: 3.0, Finance: 1.5 } },
    { day: 'Thu', hours: 6.5, categories: { Temporal: 4.0, Revenue: 1.5, Housing: 1.0 } },
    { day: 'Fri', hours: 5.0, categories: { Temporal: 3.5, Tax: 1.5 } },
    { day: 'Sat', hours: 2.0, categories: { Personal: 2.0 } },
    { day: 'Sun', hours: 0, categories: {} },
  ];
  const maxH = 8;
  const colors: Record<string, string> = {
    Temporal: '#3b82f6', Revenue: '#8b5cf6', Tax: '#ef4444',
    Finance: '#10b981', Admin: '#6b7280', Housing: '#f59e0b', Personal: '#ec4899',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-400">Focus Hours This Week</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium">+18% WoW</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-[120px] px-1">
        {days.map((day, i) => {
          const segments = Object.entries(day.categories);
          return (
            <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${(day.hours / maxH) * 100}px` }}>
                {segments.map(([cat, h]) => (
                  <motion.div
                    key={cat}
                    initial={{ height: 0 }}
                    animate={{ height: `${(h / day.hours) * 100}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 0.5 }}
                    style={{ backgroundColor: colors[cat] || '#6b7280' }}
                    className="w-full min-h-[2px] opacity-80"
                  />
                ))}
              </div>
              <span className="text-[9px] text-zinc-600">{day.day}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3">
        {['Temporal', 'Revenue', 'Tax'].map(cat => (
          <div key={cat} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors[cat] }} />
            <span className="text-[9px] text-zinc-500">{cat}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ===== Dashboard View: Financial ===== */

function FinancialView() {
  const entries = [
    { type: 'generated', label: 'Artis WHO contract', amount: '$12,000', icon: TrendingUp, color: 'text-emerald-400' },
    { type: 'generated', label: 'Tricentis video course', amount: '$6,500', icon: TrendingUp, color: 'text-emerald-400' },
    { type: 'moved', label: 'Rent payment', amount: '$850', icon: DollarSign, color: 'text-blue-400' },
    { type: 'cut', label: 'AWS bill reduction', amount: '$340', icon: BarChart3, color: 'text-amber-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-medium text-zinc-400">Financial Impact This Month</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Generated', value: '$39,326', color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
          { label: 'Moved', value: '$20,150', color: 'text-blue-400', bg: 'bg-blue-500/5' },
          { label: 'Cut', value: '$2,840', color: 'text-amber-400', bg: 'bg-amber-500/5' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-white/[0.04] p-2.5 text-center`}>
            <div className={`text-base font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent entries */}
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.label}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] border border-white/[0.03] px-3 py-2"
          >
            <entry.icon className={`w-3 h-3 ${entry.color}`} />
            <span className="text-sm text-zinc-400 flex-1 truncate">{entry.label}</span>
            <span className={`text-xs font-medium ${entry.color}`}>{entry.amount}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-600 uppercase tracking-wider">{entry.type}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
