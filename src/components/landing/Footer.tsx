export function Footer() {
  return (
    <footer className="relative py-8 px-6">
      <div className="absolute top-0 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="text-sm text-zinc-600 tracking-wide">
          CEO Mission Control
        </div>
        <div className="text-xs text-zinc-700">
          &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
