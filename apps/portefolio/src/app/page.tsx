export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="redirect-container h-screen flex items-center justify-center">
        <meta httpEquiv="refresh" content="0;url=/home" />
        <p className="text-lg font-medium">Redirecting to portfolio...</p>
      </div>
    </main>
  );
}