'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';

const EMPLOYEE_OPTIONS = [
  { value: '', label: 'Company size' },
  { value: '1', label: 'Just me' },
  { value: '2-5', label: '2–5 employees' },
  { value: '6-20', label: '6–20 employees' },
  { value: '21-50', label: '21–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '200+', label: '200+ employees' },
];

export function WaitlistForm() {
  const [form, setForm] = useState({ email: '', name: '', title: '', company: '', employeeCount: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
      } else {
        setErrorMsg(data.error || 'Something went wrong');
        setStatus(res.status === 409 ? 'success' : 'error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm';

  if (status === 'success') {
    return (
      <section id="waitlist" className="relative py-28 px-6">
        <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            You&apos;re on the list
          </h3>
          <p className="text-zinc-400">
            We&apos;ll reach out when early access opens. In the meantime,
            we&apos;re building something exceptional.
          </p>
        </motion.div>
      </section>
    );
  }

  return (
    <section id="waitlist" className="relative py-28 px-6">
      <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl tracking-tight text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Get early access
          </h2>
          <p className="text-zinc-400">Join the waitlist. Be first to command your day.</p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass-card rounded-2xl p-8 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" placeholder="Full name *" required value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} />
            <input type="email" placeholder="Work email *" required value={form.email} onChange={e => update('email', e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium transition-all disabled:opacity-50 cursor-pointer"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                Join the Waitlist
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-zinc-600">
            No spam. Early access only. We respect your time.
          </p>
        </motion.form>
      </div>
    </section>
  );
}
