// Replace the ENTIRE contents of app/page.tsx in your project with this.

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-lg">ProjectHub</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-10">
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold mb-3">Welcome</h1>
          <p className="text-gray-600">
            Select and manage your final-year project topic, track progress,
            and stay in sync with your department — all in one place.
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/login/student"
            className="px-6 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800"
          >
            Student Login
          </Link>
          <Link
            href="/login/hod"
            className="px-6 py-3 rounded-lg border border-black font-medium hover:bg-gray-100"
          >
            HoD Login
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-sm text-gray-500 text-center">
        © {new Date().getFullYear()} ProjectHub
      </footer>
    </div>
  )
}
