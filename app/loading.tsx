export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white/70 backdrop-blur-sm">
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <div className="text-sm font-extrabold text-slate-700">Memuat...</div>
        </div>
      </div>
    </div>
  );
}
