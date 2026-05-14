import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center -mx-6 sm:-mx-10 lg:-mx-12">
      {/* Hero Section */}
      <section className="w-full flex flex-col items-center justify-center py-24 max-sm:py-16 sm:py-32 px-6 bg-gradient-to-b from-background-secondary/50 to-background">
        <div className="max-w-4xl text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <h1 className="text-3xl max-sm:text-2xl sm:text-4xl md:text-5xl font-extrabold text-primary leading-tight tracking-tight mb-6 max-sm:mb-4">
            Turn Any YouTube Video into a <br className="hidden sm:block" />
            <span className="bg-span-bg bg-clip-text text-transparent">Digital Recipe.</span>
          </h1>
          
          <p className="text-lg max-sm:text-base sm:text-xl text-text-secondary max-w-2xl leading-relaxed mb-10 max-sm:mb-6">
            Paste any YouTube or Website URL and let our advanced AI instantly parse out the ingredients, measurements, and step-by-step instructions. Never lose a great recipe again.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 max-sm:gap-2">
            <Link 
              href="/extract" 
              className="px-8 py-4 max-sm:px-4 max-sm:py-2.5 bg-primary text-background text-lg max-sm:text-sm font-bold rounded-xl max-sm:rounded-lg shadow-lg shadow-primary/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300"
            >
              Extract a Recipe
            </Link>
            <Link 
              href="/add" 
              className="px-8 py-4 max-sm:px-4 max-sm:py-2.5 bg-button-secondary text-primary text-lg max-sm:text-sm font-bold rounded-xl max-sm:rounded-lg shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
            >
              Add Manually
            </Link>
            <Link 
              href="/library" 
              className="px-8 py-4 max-sm:px-4 max-sm:py-2.5 bg-background text-primary border border-primary/20 text-lg max-sm:text-sm font-semibold rounded-xl max-sm:rounded-lg hover:bg-background-secondary hover:-translate-y-1 transition-all duration-300"
            >
              View My Library
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-24 max-sm:py-14 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16 max-sm:mb-10">
          <h2 className="text-3xl max-sm:text-2xl font-bold text-primary mb-4 max-sm:mb-2">Everything You Need</h2>
          <p className="text-text-secondary text-lg max-sm:text-sm">A unified vault for all your culinary inspiration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-sm:gap-4">
          {/* Feature 1 */}
          <div className="bg-background-secondary p-8 max-sm:p-4 rounded-3xl max-sm:rounded-2xl shadow-lg border border-primary/10 hover:border-primary/30 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 max-sm:w-11 max-sm:h-11 bg-primary/10 text-primary rounded-2xl max-sm:rounded-xl flex items-center justify-center text-2xl max-sm:text-xl mb-6 max-sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              📺
            </div>
            <h3 className="text-xl max-sm:text-lg font-bold text-primary mb-3 max-sm:mb-2">YouTube Integration</h3>
            <p className="text-text-secondary leading-relaxed max-sm:text-sm">
              We automatically turn YouTube videos into readable, step-by-step recipes.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-background-secondary p-8 max-sm:p-4 rounded-3xl max-sm:rounded-2xl shadow-lg border border-primary/10 hover:border-primary/30 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 max-sm:w-11 max-sm:h-11 bg-primary/10 text-primary rounded-2xl max-sm:rounded-xl flex items-center justify-center text-2xl max-sm:text-xl mb-6 max-sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              ⚡
            </div>
            <h3 className="text-xl max-sm:text-lg font-bold text-primary mb-3 max-sm:mb-2">AI Intelligence</h3>
            <p className="text-text-secondary leading-relaxed max-sm:text-sm">
              Our smart AI ignores sponsors and messy text, keeping only the exact ingredients and instructions you need.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-background-secondary p-8 max-sm:p-4 rounded-3xl max-sm:rounded-2xl shadow-lg border border-primary/10 hover:border-primary/30 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 max-sm:w-11 max-sm:h-11 bg-primary/10 text-primary rounded-2xl max-sm:rounded-xl flex items-center justify-center text-2xl max-sm:text-xl mb-6 max-sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              📚
            </div>
            <h3 className="text-xl max-sm:text-lg font-bold text-primary mb-3 max-sm:mb-2">Curated Library</h3>
            <p className="text-text-secondary leading-relaxed max-sm:text-sm">
              Save your favorite extracted recipes or write your own, all in one beautifully organized cookbook.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-20 max-sm:py-12 px-6 max-sm:px-4 mt-12 bg-primary text-background text-center rounded-3xl max-sm:rounded-2xl max-w-5xl mx-auto shadow-2xl relative overflow-hidden mb-12 max-sm:mb-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--background)_0%,transparent_100%)]"></div>
        <div className="relative z-10">
          <h2 className="text-4xl max-sm:text-2xl font-bold mb-6 max-sm:mb-4">Ready to cook something new?</h2>
          <p className="text-background/90 text-lg max-sm:text-sm mb-10 max-sm:mb-6 max-w-xl mx-auto">
            Stop losing recipes to endless scroll feeds. Start extracting and saving your favorites instantly.
          </p>
          <div className="flex flex-wrap justify-center gap-4 max-sm:gap-2">
            <Link 
              href="/extract" 
              className="px-10 py-4 max-sm:px-5 max-sm:py-2.5 bg-background text-primary text-lg max-sm:text-sm font-bold rounded-xl max-sm:rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 inline-block"
            >
              Start Extracting
            </Link>
            <Link 
              href="/add" 
              className="px-10 py-4 max-sm:px-5 max-sm:py-2.5 bg-button-secondary text-primary text-lg max-sm:text-sm font-bold rounded-xl max-sm:rounded-lg shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300 inline-block"
            >
              Add Manually
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
